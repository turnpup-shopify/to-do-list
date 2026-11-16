import { useState } from "react";
import type { List, Task } from "../types";

interface Props {
  selected: Task[];
  totalVisible: number;
  lists: List[];
  currentListId: string;
  clickupDoneStatus: string;
  onSelectAll: () => void;
  onClear: () => void;
  onExit: () => void;
  onComplete: (ids: string[]) => void;
  onDelete: (ids: string[]) => void;
  onMove: (ids: string[], listId: string) => void;
  /** Resolves with the ids that ClickUp accepted and messages for the rest. */
  onClickUpDone: (ids: string[]) => Promise<{ done: string[]; failed: string[] }>;
}

/**
 * Bulk actions for select mode. ClickUp tickets and regular tasks get
 * different actions: ClickUp ones can only be finished via ClickUp.
 */
export function SelectionBar({
  selected,
  totalVisible,
  lists,
  currentListId,
  clickupDoneStatus,
  onSelectAll,
  onClear,
  onExit,
  onComplete,
  onDelete,
  onMove,
  onClickUpDone,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const clickupOpen = selected.filter((t) => t.clickupId && !t.completed);
  const localOpen = selected.filter((t) => !t.clickupId && !t.completed);
  const local = selected.filter((t) => !t.clickupId);
  const otherLists = lists.filter((l) => l.id !== currentListId);
  const allSelected = selected.length > 0 && selected.length === totalVisible;

  const clickupDone = async () => {
    const n = clickupOpen.length;
    if (!confirm(`Set ${n} ticket${n === 1 ? "" : "s"} to ${clickupDoneStatus} in ClickUp?`))
      return;
    setBusy(true);
    setMessage(null);
    try {
      const { done, failed } = await onClickUpDone(clickupOpen.map((t) => t.id));
      setMessage(
        failed.length
          ? `${done.length} updated, ${failed.length} failed — ${failed.join("; ")}`
          : `${done.length} ticket${done.length === 1 ? "" : "s"} set to ${clickupDoneStatus}.`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="selbar" role="toolbar" aria-label="Selected tasks">
      <div className="selbar__top">
        <span className="selbar__count">{selected.length} selected</span>
        <button
          type="button"
          className="selbar__link"
          onClick={allSelected ? onClear : onSelectAll}
        >
          {allSelected ? "Clear" : "Select all"}
        </button>
        <button type="button" className="selbar__link selbar__exit" onClick={onExit}>
          Done
        </button>
      </div>

      {message && <p className="selbar__msg">{message}</p>}

      <div className="selbar__actions">
        {clickupOpen.length > 0 && (
          <button type="button" className="btn selbar__cu" onClick={clickupDone} disabled={busy}>
            {busy ? "Updating ClickUp…" : `CU → ${clickupDoneStatus} (${clickupOpen.length})`}
          </button>
        )}
        {localOpen.length > 0 && (
          <button
            type="button"
            className="btn"
            onClick={() => onComplete(localOpen.map((t) => t.id))}
            disabled={busy}
          >
            Complete ({localOpen.length})
          </button>
        )}
        {selected.length > 0 && otherLists.length > 0 && (
          <select
            className="selbar__move"
            value=""
            disabled={busy}
            onChange={(e) =>
              e.target.value &&
              onMove(
                selected.map((t) => t.id),
                e.target.value,
              )
            }
            aria-label="Move selected to list"
          >
            <option value="">Move to…</option>
            {otherLists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        )}
        {local.length > 0 && (
          <button
            type="button"
            className="btn btn--danger"
            disabled={busy}
            onClick={() => {
              if (confirm(`Delete ${local.length} task${local.length === 1 ? "" : "s"}?`)) {
                onDelete(local.map((t) => t.id));
              }
            }}
          >
            Delete ({local.length})
          </button>
        )}
        {selected.length === 0 && (
          <span className="selbar__hint">Tap tasks to select · shift-click for a range</span>
        )}
      </div>
    </div>
  );
}
