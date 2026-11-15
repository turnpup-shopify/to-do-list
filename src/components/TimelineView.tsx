import { useEffect, useMemo, useState } from "react";
import type { List, MonthlyItem, Task } from "../types";
import { addMonths, currentMonth, monthLabel, monthParts } from "../lib/format";
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
  onOpenList: () => void;
}

type Mode = "board" | "list";

const MODES: { value: Mode; label: string }[] = [
  { value: "board", label: "Months" },
  { value: "list", label: "List" },
];

const MODE_KEY = "todo.timelineMode";
/** How many months the board shows at once. */
const BOARD_MONTHS = 6;

function loadMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === "list" ? "list" : "board";
  } catch {
    return "board";
  }
}

/** The monthly roadmap: months → launch items → (breakout) sub-items. */
export function TimelineView({ monthlyItems, tasks, lists, suggestions, defaultListId, actions, onOpenList }: Props) {
  const [title, setTitle] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [mode, setModeState] = useState<Mode>(loadMode);

  const setMode = (m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* per-device convenience only */
    }
  };

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
  const cardProps = { tasks, lists, suggestions, defaultListId, actions };

  return (
    <>
      <header className="main__header">
        <h2 className="main__title main__title--static">Timeline</h2>
        <button type="button" className="btn btn--primary" onClick={onOpenList}>
          ✓ To-Do List
        </button>
      </header>

      <div className="segmented" role="tablist" aria-label="Timeline view">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="tab"
            aria-selected={mode === m.value}
            className={`segmented__btn ${mode === m.value ? "segmented__btn--active" : ""}`}
            onClick={() => setMode(m.value)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "board" ? (
        <MonthBoard byMonth={byMonth} cardProps={cardProps} />
      ) : (
        <>
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
                  <MonthlyItemCard key={item.id} item={item} {...cardProps} />
                ))}
              </section>
            ))
          )}
        </>
      )}
    </>
  );
}

type CardProps = Omit<React.ComponentProps<typeof MonthlyItemCard>, "item" | "defaultExpanded">;

/** Sub-item progress across a set of launch items. */
function progress(items: MonthlyItem[], tasks: Task[]) {
  const ids = new Set(items.map((i) => i.id));
  const subs = tasks.filter((t) => t.monthlyItemId && ids.has(t.monthlyItemId));
  return { done: subs.filter((t) => t.completed).length, total: subs.length };
}

/**
 * A grid of upcoming months. Clicking a month opens it in a side drawer (the
 * board stays put behind it); launch items can be dragged between months.
 */
function MonthBoard({
  byMonth,
  cardProps,
}: {
  byMonth: [string, MonthlyItem[]][];
  cardProps: CardProps;
}) {
  const thisMonth = currentMonth();
  const [start, setStart] = useState(thisMonth);
  const [open, setOpen] = useState<{ month: string; itemId: string | null } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropMonth, setDropMonth] = useState<string | null>(null);

  const itemsFor = useMemo(() => new Map(byMonth), [byMonth]);
  const months = Array.from({ length: BOARD_MONTHS }, (_, i) => addMonths(start, i));
  const end = months[months.length - 1];
  const earlier = byMonth.filter(([m]) => m < start).reduce((n, [, items]) => n + items.length, 0);
  const later = byMonth.filter(([m]) => m > end).reduce((n, [, items]) => n + items.length, 0);

  const drop = (m: string) => {
    if (dragId) cardProps.actions.updateMonthlyItem(dragId, { month: m });
    setDragId(null);
    setDropMonth(null);
  };

  return (
    <>
      <div className="board__nav">
        <button type="button" className="icon-btn" onClick={() => setStart(addMonths(start, -1))} aria-label="Earlier">
          ‹
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => setStart(thisMonth)}
          disabled={start === thisMonth}
        >
          Today
        </button>
        <button type="button" className="icon-btn" onClick={() => setStart(addMonths(start, 1))} aria-label="Later">
          ›
        </button>
        <span className="board__range">
          {earlier > 0 && <span>← {earlier} earlier</span>}
          {later > 0 && <span>{later} later →</span>}
        </span>
      </div>

      <div className="board">
        {months.map((m) => {
          const items = itemsFor.get(m) ?? [];
          const { done, total } = progress(items, cardProps.tasks);
          const allDone = total > 0 && done === total;
          const { month, year } = monthParts(m);
          return (
            <div
              key={m}
              role="button"
              tabIndex={0}
              className={[
                "mcard",
                m === thisMonth && "mcard--now",
                m < thisMonth && "mcard--past",
                allDone && "mcard--done",
                dropMonth === m && "mcard--drop",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setOpen({ month: m, itemId: null })}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpen({ month: m, itemId: null });
                }
              }}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                setDropMonth(m);
              }}
              onDragLeave={() => setDropMonth((d) => (d === m ? null : d))}
              onDrop={(e) => {
                e.preventDefault();
                drop(m);
              }}
            >
              <div className="mcard__head">
                <span className="mcard__month">{month}</span>
                <span className="mcard__year">{year}</span>
                {m === thisMonth && <span className="tl-month__badge">now</span>}
                {allDone && <span className="mcard__party" title="Everything shipped!">🎉</span>}
              </div>

              <div className="mcard__bar" aria-hidden>
                <span style={{ width: total ? `${(done / total) * 100}%` : 0 }} />
              </div>
              <span className="mcard__stat">
                {items.length === 0
                  ? "Nothing planned"
                  : `${items.length} launch${items.length === 1 ? "" : "es"} · ${done}/${total} done`}
              </span>

              <ul className="mcard__items">
                {items.map((item) => {
                  const p = progress([item], cardProps.tasks);
                  const itemDone = p.total > 0 && p.done === p.total;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        draggable
                        className={`mchip ${itemDone ? "mchip--done" : ""} ${dragId === item.id ? "mchip--dragging" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen({ month: m, itemId: item.id });
                        }}
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", item.id);
                          setDragId(item.id);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setDropMonth(null);
                        }}
                        title="Click to open · drag to another month"
                      >
                        <span className="mchip__dot" aria-hidden>
                          {itemDone ? "✓" : ""}
                        </span>
                        <span className="mchip__title">{item.title}</span>
                        {p.total > 0 && (
                          <span className="mchip__count">
                            {p.done}/{p.total}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>

              <span className="mcard__add">+ Plan something</span>
            </div>
          );
        })}
      </div>

      {open && (
        <MonthDrawer
          month={open.month}
          focusItemId={open.itemId}
          items={itemsFor.get(open.month) ?? []}
          cardProps={cardProps}
          onStep={(n) => setOpen({ month: addMonths(open.month, n), itemId: null })}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}

/** Side drawer showing one month's launch items, with an add form. */
function MonthDrawer({
  month,
  focusItemId,
  items,
  cardProps,
  onStep,
  onClose,
}: {
  month: string;
  focusItemId: string | null;
  items: MonthlyItem[];
  cardProps: CardProps;
  onStep: (n: number) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const { done, total } = progress(items, cardProps.tasks);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    cardProps.actions.addMonthlyItem(title, month);
    setTitle("");
  };

  return (
    <div className="overlay overlay--right" onClick={onClose}>
      <div
        className="panel panel--right"
        role="dialog"
        aria-label={monthLabel(month)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel__header">
          <button type="button" className="icon-btn" onClick={() => onStep(-1)} aria-label="Previous month">
            ‹
          </button>
          <h2 className="drawer__title">
            {monthLabel(month)}
            {month === currentMonth() && <span className="tl-month__badge">this month</span>}
          </h2>
          <button type="button" className="icon-btn" onClick={() => onStep(1)} aria-label="Next month">
            ›
          </button>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {total > 0 && (
          <>
            <div className="mcard__bar mcard__bar--lg" aria-hidden>
              <span style={{ width: `${(done / total) * 100}%` }} />
            </div>
            <p className="panel__hint">
              {done === total ? "Everything shipped 🎉" : `${done} of ${total} sub-items done`}
            </p>
          </>
        )}

        <form className="add-task" onSubmit={submit}>
          <input
            type="text"
            placeholder={`Launch something in ${monthParts(month).month}…`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus={!focusItemId}
          />
          <button type="submit" className="btn btn--primary">
            Add
          </button>
        </form>

        {items.length === 0 ? (
          <p className="empty">Nothing planned yet — a blank canvas.</p>
        ) : (
          items.map((item) => (
            <MonthlyItemCard
              key={`${month}-${item.id}`}
              item={item}
              defaultExpanded={item.id === focusItemId}
              {...cardProps}
            />
          ))
        )}
      </div>
    </div>
  );
}

function MonthlyItemCard({
  item,
  tasks,
  lists,
  suggestions,
  defaultListId,
  actions,
  defaultExpanded = false,
}: {
  item: MonthlyItem;
  tasks: Task[];
  lists: List[];
  suggestions: string[];
  defaultListId: string | null;
  actions: Actions;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
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
