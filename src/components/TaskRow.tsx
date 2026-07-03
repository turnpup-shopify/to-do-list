import { useState } from "react";
import type { Task } from "../types";
import { parseTags } from "../lib/operations";
import { formatDateTime, formatDueDate, isOverdue } from "../lib/format";
import { Linkify } from "./Linkify";

interface Props {
  task: Task;
  /** Suggested tags (defaults + already-used) to offer for quick tagging. */
  suggestions: string[];
  onToggle: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Task>) => void;
  onDelete: (id: string) => void;
  // Pointer-based drag-and-drop reordering (works with mouse and touch).
  isDragging: boolean;
  isDragOver: boolean;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}

export function TaskRow({
  task,
  suggestions,
  onToggle,
  onUpdate,
  onDelete,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  // Raw tag text is edited locally and parsed into clean tags on blur.
  const [tagText, setTagText] = useState(task.tags.join(", "));

  const commitTags = () => {
    const parsed = parseTags(tagText);
    setTagText(parsed.join(", "));
    onUpdate(task.id, { tags: parsed });
  };

  const addSuggested = (tag: string) => {
    if (task.tags.includes(tag)) return;
    const next = [...task.tags, tag];
    setTagText(next.join(", "));
    onUpdate(task.id, { tags: next });
  };

  const unusedSuggestions = suggestions.filter((t) => !task.tags.includes(t));
  const overdue = isOverdue(task.dueDate) && !task.completed;

  const className = [
    "task",
    task.completed ? "task--done" : "",
    isDragging ? "task--dragging" : "",
    isDragOver ? "task--dragover" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li className={className} data-task-id={task.id}>
      <div className="task__row">
        <span
          className="task__grip"
          role="button"
          aria-label="Drag to reorder"
          title="Drag to reorder"
          onPointerDown={(e) => {
            if (e.button !== 0 && e.pointerType === "mouse") return; // primary click only
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            onDragStart(task.id);
          }}
          onPointerMove={(e) => {
            if (!isDragging) return;
            // Find the task row currently under the pointer/finger.
            const el = document.elementFromPoint(e.clientX, e.clientY);
            const row = el?.closest<HTMLElement>("[data-task-id]");
            const overId = row?.dataset.taskId;
            if (overId) onDragOver(overId);
          }}
          onPointerUp={(e) => {
            if (!isDragging) return;
            e.currentTarget.releasePointerCapture?.(e.pointerId);
            onDrop();
          }}
          onPointerCancel={onDragEnd}
        >
          ⠿
        </span>
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
        {task.dueDate && (
          <span className={`due ${overdue ? "due--overdue" : ""}`} title="Due date">
            {formatDueDate(task.dueDate)}
          </span>
        )}
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
            <span className="field__label">Due date</span>
            <input
              type="date"
              value={task.dueDate ?? ""}
              onChange={(e) => onUpdate(task.id, { dueDate: e.target.value || null })}
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
          {unusedSuggestions.length > 0 && (
            <div className="suggestions">
              {unusedSuggestions.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className="chip chip--add"
                  onClick={() => addSuggested(tag)}
                >
                  + {tag}
                </button>
              ))}
            </div>
          )}

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
