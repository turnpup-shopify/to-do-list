import { useState } from "react";
import type { Task } from "../types";
import { parseTags } from "../lib/operations";
import { formatDateTime } from "../lib/format";
import { Linkify } from "./Linkify";

interface Props {
  task: Task;
  onToggle: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Task>) => void;
  onDelete: (id: string) => void;
}

export function TaskRow({ task, onToggle, onUpdate, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  // Raw tag text is edited locally and parsed into clean tags on blur.
  const [tagText, setTagText] = useState(task.tags.join(", "));

  const commitTags = () => {
    const parsed = parseTags(tagText);
    setTagText(parsed.join(", "));
    onUpdate(task.id, { tags: parsed });
  };

  return (
    <li className={`task ${task.completed ? "task--done" : ""}`}>
      <div className="task__row">
        <input
          type="checkbox"
          className="task__check"
          checked={task.completed}
          onChange={() => onToggle(task.id)}
          aria-label={task.completed ? "Mark as not done" : "Mark as done"}
        />
        <button
          type="button"
          className="task__title"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
        >
          <span className="task__title-text">{task.title}</span>
          {task.tags.length > 0 && (
            <span className="task__tags">
              {task.tags.map((t) => (
                <span key={t} className="chip chip--sm">
                  {t}
                </span>
              ))}
            </span>
          )}
        </button>
        <span className="task__chevron" aria-hidden>
          {expanded ? "▾" : "▸"}
        </span>
      </div>

      {expanded && (
        <div className="task__details">
          <label className="field">
            <span className="field__label">Title</span>
            <input
              type="text"
              value={task.title}
              onChange={(e) => onUpdate(task.id, { title: e.target.value })}
            />
          </label>

          <label className="field">
            <span className="field__label">Description</span>
            <textarea
              rows={3}
              placeholder="Notes, links…"
              value={task.description}
              onChange={(e) => onUpdate(task.id, { description: e.target.value })}
            />
          </label>
          {task.description.trim() && (
            <div className="task__preview">
              <Linkify text={task.description} />
            </div>
          )}

          <label className="field">
            <span className="field__label">Tags</span>
            <input
              type="text"
              placeholder="comma or space separated"
              value={tagText}
              onChange={(e) => setTagText(e.target.value)}
              onBlur={commitTags}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTags();
              }}
            />
          </label>

          <dl className="meta">
            <div>
              <dt>Created</dt>
              <dd>{formatDateTime(task.createdAt)}</dd>
            </div>
            <div>
              <dt>Completed</dt>
              <dd>{formatDateTime(task.completedAt)}</dd>
            </div>
          </dl>

          <div className="task__actions">
            <button
              type="button"
              className="btn btn--danger"
              onClick={() => onDelete(task.id)}
            >
              Delete task
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
