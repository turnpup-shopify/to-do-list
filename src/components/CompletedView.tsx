import { useMemo, useState } from "react";
import type { List, Task } from "../types";
import { groupCompleted, type GroupMode } from "../lib/grouping";
import { formatDateTime } from "../lib/format";

interface Props {
  tasks: Task[];
  lists: List[];
  onToggle: (id: string) => void;
}

const MODES: { value: GroupMode; label: string }[] = [
  { value: "none", label: "No grouping" },
  { value: "week", label: "By week" },
  { value: "month", label: "By month" },
];

/** Global view of every completed task, newest-first, optionally grouped. */
export function CompletedView({ tasks, lists, onToggle }: Props) {
  const [mode, setMode] = useState<GroupMode>("none");

  const listName = (id: string) => lists.find((l) => l.id === id)?.name ?? "";

  const completed = useMemo(
    () =>
      tasks
        .filter((t) => t.completed && t.completedAt)
        .sort((a, b) => (a.completedAt! < b.completedAt! ? 1 : -1)),
    [tasks],
  );

  const groups = useMemo(() => groupCompleted(completed, mode), [completed, mode]);

  return (
    <>
      <header className="main__header">
        <h2 className="main__title main__title--static">Completed</h2>
      </header>

      <div className="segmented" role="tablist" aria-label="Group completed by">
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

      {completed.length === 0 ? (
        <p className="empty">Nothing completed yet.</p>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="cgroup">
            {group.label && <h3 className="cgroup__label">{group.label}</h3>}
            <ul className="tasks">
              {group.items.map((task) => (
                <li key={task.id} className="ctask">
                  <input
                    type="checkbox"
                    className="task__check"
                    checked
                    onChange={() => onToggle(task.id)}
                    aria-label={`Mark "${task.title}" as not done`}
                  />
                  <span className="ctask__title">{task.title}</span>
                  {task.tags.length > 0 && (
                    <span className="task__tags">
                      {task.tags.map((t) => (
                        <span key={t} className="chip chip--sm">
                          {t}
                        </span>
                      ))}
                    </span>
                  )}
                  {listName(task.listId) && (
                    <span className="ctask__list">{listName(task.listId)}</span>
                  )}
                  <span className="ctask__date">{formatDateTime(task.completedAt)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
