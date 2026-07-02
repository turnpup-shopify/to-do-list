import { useEffect, useMemo, useState } from "react";
import { useStore } from "./lib/useStore";
import { collectTags } from "./lib/operations";
import { Sidebar } from "./components/Sidebar";
import { TaskRow } from "./components/TaskRow";
import { SettingsMenu } from "./components/SettingsMenu";

export default function App() {
  const { data, loaded, actions } = useStore();

  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [showCompleted, setShowCompleted] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

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

  // Tags offered as quick-add suggestions: defaults first, then any others in use.
  const suggestions = useMemo(() => {
    const merged = [...data.settings.defaultTags];
    for (const t of availableTags) if (!merged.includes(t)) merged.push(t);
    return merged;
  }, [data.settings.defaultTags, availableTags]);

  // Drop any active tag filters that no longer exist in the current list.
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

  const handleDrop = (targetId: string) => {
    if (draggedId && draggedId !== targetId) actions.reorderTasks(draggedId, targetId);
    setDraggedId(null);
    setDragOverId(null);
  };

  if (!loaded) {
    return <div className="app app--loading">Loading…</div>;
  }

  return (
    <div className="app">
      <Sidebar
        lists={data.lists}
        tasks={data.tasks}
        activeListId={activeListId}
        onSelect={setActiveListId}
        onAddList={(name) => actions.addList(name)}
        onOpenMenu={() => setMenuOpen(true)}
      />

      <main className="main">
        {activeList ? (
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
            </header>

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
                    onToggle={actions.toggleTask}
                    onUpdate={actions.updateTask}
                    onDelete={actions.deleteTask}
                    isDragging={draggedId === task.id}
                    isDragOver={dragOverId === task.id && draggedId !== task.id}
                    onDragStart={setDraggedId}
                    onDragEnter={setDragOverId}
                    onDrop={handleDrop}
                    onDragEnd={() => {
                      setDraggedId(null);
                      setDragOverId(null);
                    }}
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
        onAdd={(tag) => actions.addDefaultTag(tag)}
        onRemove={(tag) => actions.removeDefaultTag(tag)}
        onClose={() => setMenuOpen(false)}
      />
    </div>
  );
}
