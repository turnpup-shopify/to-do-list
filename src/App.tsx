import { useEffect, useMemo, useState } from "react";
import { useStore } from "./lib/useStore";
import { HttpRepository, UnauthorizedError, verifyPassphrase, type Repository } from "./lib/repository";
import { clickupListId, collectTags, syncClickUp } from "./lib/operations";
import { fetchClickUpTickets, setClickUpStatus } from "./lib/clickup";
import { Sidebar } from "./components/Sidebar";
import { TaskRow } from "./components/TaskRow";
import { CompletedView } from "./components/CompletedView";
import { TimelineView } from "./components/TimelineView";
import { SettingsMenu } from "./components/SettingsMenu";
import { PassphraseGate } from "./components/PassphraseGate";
import { PASSPHRASE_KEY } from "./lib/auth";

/**
 * Top level: gate on a passphrase, then run the app against a backend-backed
 * repository. The passphrase is remembered per device in localStorage.
 *
 * `passphrase` distinguishes three states:
 *   null  — not authenticated (show the gate, once we've confirmed one is needed)
 *   ""    — server has no passphrase configured; the app is open, no gate
 *   "…"   — authenticated with a real passphrase
 */
export default function App() {
  const [passphrase, setPassphrase] = useState<string | null>(() =>
    localStorage.getItem(PASSPHRASE_KEY),
  );
  // Only probe when we don't already have a stored passphrase.
  const [checking, setChecking] = useState(() => localStorage.getItem(PASSPHRASE_KEY) === null);

  // If nothing is stored, ask the backend whether a passphrase is required at
  // all: an unauthenticated request succeeds only when the app is left open.
  useEffect(() => {
    if (!checking) return;
    let cancelled = false;
    verifyPassphrase("").then((open) => {
      if (cancelled) return;
      if (open) setPassphrase(""); // no passphrase configured → skip the gate
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [checking]);

  const repository = useMemo(
    () => (passphrase !== null ? new HttpRepository(passphrase) : null),
    [passphrase],
  );

  const authenticate = (pass: string) => {
    localStorage.setItem(PASSPHRASE_KEY, pass);
    setPassphrase(pass);
  };

  const signOut = () => {
    localStorage.removeItem(PASSPHRASE_KEY);
    setPassphrase(null);
    setChecking(true); // re-probe (also handles the app being open)
  };

  if (checking) {
    return <div className="app app--loading">Loading…</div>;
  }

  if (!repository) {
    return <PassphraseGate onAuthenticated={authenticate} />;
  }

  return (
    <TodoApp repository={repository} onSignOut={signOut} canSignOut={passphrase !== ""} />
  );
}

function TodoApp({
  repository,
  onSignOut,
  canSignOut,
}: {
  repository: Repository;
  onSignOut: () => void;
  canSignOut: boolean;
}) {
  // A rejected passphrase (e.g. changed on the server) drops back to the gate.
  const { data, loaded, error, actions } = useStore(repository, { onUnauthorized: onSignOut });

  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [showCompleted, setShowCompleted] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile lists drawer
  const [view, setView] = useState<"list" | "completed" | "timeline">("list");
  const [clickupBusy, setClickupBusy] = useState(false);
  const [clickupMsg, setClickupMsg] = useState<string | null>(null);

  // Drag-and-drop reordering state.
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Keep a valid list selected as lists are added/removed.
  useEffect(() => {
    if (!loaded) return;
    const stillExists = data.lists.some((l) => l.id === activeListId);
    if (!stillExists) setActiveListId(data.lists[0]?.id ?? null);
  }, [loaded, data.lists, activeListId]);

  const activeList = data.lists.find((l) => l.id === activeListId) ?? null;

  const listTasks = useMemo(
    () => data.tasks.filter((t) => t.listId === activeListId),
    [data.tasks, activeListId],
  );

  const availableTags = useMemo(() => collectTags(listTasks), [listTasks]);

  const suggestions = useMemo(() => {
    const merged = [...data.settings.defaultTags];
    for (const t of availableTags) if (!merged.includes(t)) merged.push(t);
    return merged;
  }, [data.settings.defaultTags, availableTags]);

  useEffect(() => {
    setActiveTags((tags) => tags.filter((t) => availableTags.includes(t)));
  }, [availableTags]);

  const visibleTasks = useMemo(() => {
    return listTasks.filter((task) => {
      if (!showCompleted && task.completed) return false;
      if (activeTags.length > 0 && !activeTags.every((t) => task.tags.includes(t))) {
        return false;
      }
      return true;
    });
  }, [listTasks, activeTags, showCompleted]);

  const toggleTagFilter = (tag: string) =>
    setActiveTags((tags) => (tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]));

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeListId || !newTask.trim()) return;
    actions.addTask(activeListId, newTask);
    setNewTask("");
  };

  const removeActiveList = () => {
    if (!activeList) return;
    if (confirm(`Delete list "${activeList.name}" and all its tasks?`)) {
      actions.deleteList(activeList.id);
    }
  };

  const clickupTarget = clickupListId(data);

  const runClickUpSync = async () => {
    if (!clickupTarget) return;
    setClickupBusy(true);
    setClickupMsg(null);
    try {
      const passphrase = localStorage.getItem(PASSPHRASE_KEY) ?? "";
      const { tickets, complete } = await fetchClickUpTickets(data.settings.clickup, passphrase);
      const { added, closed } = syncClickUp(data, clickupTarget, tickets, complete);
      actions.syncClickUp(clickupTarget, tickets, complete);
      setClickupMsg(
        added || closed
          ? `ClickUp: ${added} new, ${closed} checked off.`
          : `ClickUp: up to date (${tickets.length} open ticket${tickets.length === 1 ? "" : "s"}).`,
      );
    } catch (err) {
      if (err instanceof UnauthorizedError) return onSignOut();
      setClickupMsg(err instanceof Error ? err.message : "ClickUp sync failed.");
    } finally {
      setClickupBusy(false);
    }
  };

  // Write-back: set the ticket's status in ClickUp, then check it off here.
  const markClickUpDone = async (taskId: string) => {
    const task = data.tasks.find((t) => t.id === taskId);
    if (!task?.clickupId) return;
    try {
      const passphrase = localStorage.getItem(PASSPHRASE_KEY) ?? "";
      await setClickUpStatus(task.clickupId, data.settings.clickup.doneStatus, passphrase);
    } catch (err) {
      if (err instanceof UnauthorizedError) onSignOut();
      throw err;
    }
    if (!task.completed) actions.toggleTask(task.id);
  };

  const handleDrop = () => {
    if (draggedId && dragOverId && draggedId !== dragOverId) {
      actions.reorderTasks(draggedId, dragOverId);
    }
    setDraggedId(null);
    setDragOverId(null);
  };

  const endDrag = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  if (!loaded) {
    return <div className="app app--loading">{error ?? "Loading…"}</div>;
  }

  return (
    <div className="app">
      {sidebarOpen && <div className="scrim" onClick={() => setSidebarOpen(false)} />}

      <Sidebar
        lists={data.lists}
        tasks={data.tasks}
        activeListId={activeListId}
        onSelect={(id) => {
          setActiveListId(id);
          setView("list");
        }}
        onAddList={(name) => actions.addList(name)}
        onOpenMenu={() => setMenuOpen(true)}
        activeView={view}
        onSelectCompleted={() => setView("completed")}
        onSelectTimeline={() => setView("timeline")}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="main">
        {/* Mobile-only top bar: opens the lists drawer. */}
        <div className="mobile-bar">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open lists"
            title="Lists"
          >
            ☰
          </button>
          <span className="mobile-bar__title">To-Do</span>
        </div>

        {error && <div className="banner banner--warn">{error}</div>}

        {view === "timeline" ? (
          <TimelineView
            monthlyItems={data.monthlyItems}
            tasks={data.tasks}
            lists={data.lists}
            suggestions={suggestions}
            defaultListId={activeListId ?? data.lists[0]?.id ?? null}
            actions={actions}
            onOpenList={() => setView("list")}
          />
        ) : view === "completed" ? (
          <CompletedView tasks={data.tasks} lists={data.lists} onToggle={actions.toggleTask} />
        ) : activeList ? (
          <>
            <header className="main__header">
              <input
                className="main__title"
                value={activeList.name}
                onChange={(e) => actions.renameList(activeList.id, e.target.value)}
                aria-label="List name"
              />
              <button type="button" className="btn btn--ghost" onClick={removeActiveList}>
                Delete list
              </button>
              {activeList.id === clickupTarget && (
                <button type="button" className="btn" onClick={runClickUpSync} disabled={clickupBusy}>
                  {clickupBusy ? "Syncing…" : "⟳ ClickUp"}
                </button>
              )}
              <button type="button" className="btn btn--primary" onClick={() => setView("timeline")}>
                🗓 Timeline
              </button>
            </header>

            {clickupMsg && activeList.id === clickupTarget && (
              <div className="banner" onClick={() => setClickupMsg(null)}>
                {clickupMsg}
              </div>
            )}

            <form className="add-task" onSubmit={addTask}>
              <input
                type="text"
                placeholder="Add a task…"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                autoFocus
              />
              <button type="submit" className="btn btn--primary">
                Add
              </button>
            </form>

            {(availableTags.length > 0 || !showCompleted) && (
              <div className="filters">
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`chip ${activeTags.includes(tag) ? "chip--active" : ""}`}
                    onClick={() => toggleTagFilter(tag)}
                  >
                    {tag}
                  </button>
                ))}
                <label className="filters__toggle">
                  <input
                    type="checkbox"
                    checked={showCompleted}
                    onChange={(e) => setShowCompleted(e.target.checked)}
                  />
                  Show completed
                </label>
              </div>
            )}

            {visibleTasks.length > 0 ? (
              <ul className="tasks">
                {visibleTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    suggestions={suggestions}
                    lists={data.lists}
                    currentListId={activeListId!}
                    monthlyItems={data.monthlyItems}
                    onToggle={actions.toggleTask}
                    onUpdate={actions.updateTask}
                    onDelete={actions.deleteTask}
                    onMove={actions.moveTask}
                    clickupDoneStatus={data.settings.clickup.doneStatus}
                    onClickUpDone={markClickUpDone}
                    isDragging={draggedId === task.id}
                    isDragOver={dragOverId === task.id && draggedId !== task.id}
                    onDragStart={setDraggedId}
                    onDragOver={setDragOverId}
                    onDrop={handleDrop}
                    onDragEnd={endDrag}
                  />
                ))}
              </ul>
            ) : (
              <p className="empty">
                {listTasks.length === 0 ? "No tasks yet — add one above." : "Nothing matches the current filter."}
              </p>
            )}
          </>
        ) : (
          <div className="empty empty--center">
            <p>Create a list to get started.</p>
          </div>
        )}
      </main>

      <SettingsMenu
        open={menuOpen}
        defaultTags={data.settings.defaultTags}
        clickup={data.settings.clickup}
        clickupListId={clickupTarget}
        lists={data.lists}
        onUpdateClickUp={actions.updateClickUpSettings}
        onAdd={(tag) => actions.addDefaultTag(tag)}
        onRemove={(tag) => actions.removeDefaultTag(tag)}
        onClose={() => setMenuOpen(false)}
        onSignOut={onSignOut}
        canSignOut={canSignOut}
      />
    </div>
  );
}
