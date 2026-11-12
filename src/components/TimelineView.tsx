import { useEffect, useMemo, useState } from "react";
import type { List, MonthlyItem, Task } from "../types";
import { currentMonth, monthLabel } from "../lib/format";
import { TaskRow } from "./TaskRow";

interface Actions {
  addMonthlyItem: (title: string, month: string) => void;
  updateMonthlyItem: (id: string, patch: Partial<Omit<MonthlyItem, "id" | "createdAt">>) => void;
  deleteMonthlyItem: (id: string) => void;
  addTask: (listId: string, title: string, monthlyItemId?: string | null) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  toggleTask: (id: string) => void;
  deleteTask: (id: string) => void;
}

interface Props {
  monthlyItems: MonthlyItem[];
  tasks: Task[];
  lists: List[];
  suggestions: string[];
  defaultListId: string | null;
  actions: Actions;
}

/** The monthly roadmap: months → launch items → (breakout) sub-items. */
export function TimelineView({ monthlyItems, tasks, lists, suggestions, defaultListId, actions }: Props) {
  const [title, setTitle] = useState("");
  const [month, setMonth] = useState(currentMonth());

  // Group launch items by month, earliest first.
  const byMonth = useMemo(() => {
    const map = new Map<string, MonthlyItem[]>();
    for (const mi of monthlyItems) {
      const arr = map.get(mi.month);
      if (arr) arr.push(mi);
      else map.set(mi.month, [mi]);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  }, [monthlyItems]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    actions.addMonthlyItem(title, month);
    setTitle("");
  };

  const thisMonth = currentMonth();

  return (
    <>
      <header className="main__header">
        <h2 className="main__title main__title--static">Timeline</h2>
      </header>

      <form className="add-task timeline__add" onSubmit={submit}>
        <input
          type="text"
          placeholder="New monthly item to launch…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value || thisMonth)}
          aria-label="Target month"
        />
        <button type="submit" className="btn btn--primary">
          Add
        </button>
      </form>

      {byMonth.length === 0 ? (
        <p className="empty">Nothing planned yet — add what you want to launch, by month.</p>
      ) : (
        byMonth.map(([m, items]) => (
          <section key={m} className="tl-month">
            <h3 className="tl-month__label">
              {monthLabel(m)}
              {m === thisMonth && <span className="tl-month__badge">this month</span>}
            </h3>
            {items.map((item) => (
              <MonthlyItemCard
                key={item.id}
                item={item}
                tasks={tasks}
                lists={lists}
                suggestions={suggestions}
                defaultListId={defaultListId}
                actions={actions}
              />
            ))}
          </section>
        ))
      )}
    </>
  );
}

function MonthlyItemCard({
  item,
  tasks,
  lists,
  suggestions,
  defaultListId,
  actions,
}: {
  item: MonthlyItem;
  tasks: Task[];
  lists: List[];
  suggestions: string[];
  defaultListId: string | null;
  actions: Actions;
}) {
  const [expanded, setExpanded] = useState(false);
  const [subTitle, setSubTitle] = useState("");
  const [listId, setListId] = useState(defaultListId ?? lists[0]?.id ?? "");

  // Keep the chosen list valid as lists change.
  useEffect(() => {
    if (!lists.some((l) => l.id === listId)) setListId(defaultListId ?? lists[0]?.id ?? "");
  }, [lists, defaultListId, listId]);

  const subItems = useMemo(
    () => tasks.filter((t) => t.monthlyItemId === item.id),
    [tasks, item.id],
  );
  const done = subItems.filter((t) => t.completed).length;
  const complete = subItems.length > 0 && done === subItems.length;

  const addSub = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subTitle.trim() || !listId) return;
    actions.addTask(listId, subTitle, item.id);
    setSubTitle("");
  };

  return (
    <div className={`mi ${complete ? "mi--done" : ""}`}>
      <div className="mi__row">
        <button
          type="button"
          className="mi__head"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
        >
          <span className="mi__chevron" aria-hidden>
            {expanded ? "▾" : "▸"}
          </span>
          <span className="mi__title">{item.title}</span>
        </button>
        <span className={`mi__count ${complete ? "mi__count--done" : ""}`}>
          {subItems.length ? `${done}/${subItems.length}` : "—"}
        </span>
      </div>

      {expanded && (
        <div className="mi__detail">
          <label className="field">
            <span className="field__label">Title</span>
            <input
              type="text"
              value={item.title}
              onChange={(e) => actions.updateMonthlyItem(item.id, { title: e.target.value })}
            />
          </label>

          <label className="field">
            <span className="field__label">Month</span>
            <input
              type="month"
              value={item.month}
              onChange={(e) => e.target.value && actions.updateMonthlyItem(item.id, { month: e.target.value })}
            />
          </label>

          <label className="field">
            <span className="field__label">Notes</span>
            <textarea
              rows={2}
              placeholder="Context, goals, links…"
              value={item.notes}
              onChange={(e) => actions.updateMonthlyItem(item.id, { notes: e.target.value })}
            />
          </label>

          <div className="mi__subs">
            <span className="field__label">Sub-items</span>
            {subItems.length === 0 && <p className="panel__hint">No sub-items yet.</p>}
            <ul className="tasks">
              {subItems.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  suggestions={suggestions}
                  onToggle={actions.toggleTask}
                  onUpdate={actions.updateTask}
                  onDelete={actions.deleteTask}
                />
              ))}
            </ul>
            {lists.length > 0 ? (
              <form className="mi__add" onSubmit={addSub}>
                <input
                  type="text"
                  placeholder="Add a sub-item…"
                  value={subTitle}
                  onChange={(e) => setSubTitle(e.target.value)}
                />
                {lists.length > 1 && (
                  <select value={listId} onChange={(e) => setListId(e.target.value)} aria-label="List">
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                )}
                <button type="submit" className="btn">
                  Add
                </button>
              </form>
            ) : (
              <p className="panel__hint">Create a list first to add sub-items.</p>
            )}
          </div>

          <div className="mi__actions">
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => {
                if (confirm(`Delete "${item.title}"? Its sub-items stay in their lists.`)) {
                  actions.deleteMonthlyItem(item.id);
                }
              }}
            >
              Delete monthly item
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
