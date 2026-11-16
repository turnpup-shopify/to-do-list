import { useEffect, useState } from "react";
import type { ClickUpSettings, List } from "../types";
import { RemindersToggle } from "./RemindersToggle";

interface Props {
  open: boolean;
  defaultTags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  clickup: ClickUpSettings;
  /** The list ClickUp tickets currently land in (resolved, may be the fallback). */
  clickupListId: string | null;
  lists: List[];
  onUpdateClickUp: (patch: Partial<ClickUpSettings>) => void;
  onClose: () => void;
  onSignOut: () => void;
  /** Hidden when the deployment has no passphrase (nothing to sign out of). */
  canSignOut: boolean;
}

/** Slide-in panel for adjusting default tags and signing out. */
export function SettingsMenu({
  open,
  defaultTags,
  onAdd,
  onRemove,
  clickup,
  clickupListId,
  lists,
  onUpdateClickUp,
  onClose,
  onSignOut,
  canSignOut,
}: Props) {
  const [draft, setDraft] = useState("");
  // Statuses are edited as text and committed on blur, so typing commas works.
  const [statusDraft, setStatusDraft] = useState(clickup.statuses.join(", "));
  useEffect(() => setStatusDraft(clickup.statuses.join(", ")), [clickup.statuses]);

  if (!open) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onAdd(draft);
    setDraft("");
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="panel"
        role="dialog"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel__header">
          <h2>Settings</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <section className="panel__section">
          <h3>Default tags</h3>
          <p className="panel__hint">
            Suggested when tagging tasks. Add or remove to fit how you organize.
          </p>
          <div className="tag-editor">
            {defaultTags.map((tag) => (
              <span key={tag} className="chip chip--removable">
                {tag}
                <button
                  type="button"
                  className="chip__x"
                  onClick={() => onRemove(tag)}
                  aria-label={`Remove ${tag}`}
                >
                  ✕
                </button>
              </span>
            ))}
            {defaultTags.length === 0 && <span className="panel__hint">No default tags.</span>}
          </div>
          <form className="tag-editor__add" onSubmit={submit}>
            <input
              type="text"
              placeholder="Add a default tag…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit" className="btn">
              Add
            </button>
          </form>
        </section>

        <section className="panel__section panel__section--stack">
          <h3>ClickUp</h3>
          <p className="panel__hint">
            Pulls tickets assigned to you in these statuses into a list with the ⟳ ClickUp button.
            Tickets that leave them get checked off.
          </p>
          <label className="field">
            <span className="field__label">View link</span>
            <input
              type="text"
              value={clickup.view}
              onChange={(e) => onUpdateClickUp({ view: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field__label">Statuses (comma-separated)</span>
            <input
              type="text"
              value={statusDraft}
              onChange={(e) => setStatusDraft(e.target.value)}
              onBlur={() =>
                onUpdateClickUp({
                  statuses: statusDraft.split(",").map((s) => s.trim()).filter(Boolean),
                })
              }
            />
          </label>
          <label className="field">
            <span className="field__label">Add to list</span>
            <select
              value={clickupListId ?? ""}
              onChange={(e) => onUpdateClickUp({ listId: e.target.value || null })}
            >
              {!clickupListId && <option value="">— pick a list —</option>}
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        </section>

        <RemindersToggle />

        {canSignOut && (
          <section className="panel__section">
            <h3>Account</h3>
            <p className="panel__hint">Your data syncs across devices via the shared passphrase.</p>
            <button type="button" className="btn btn--danger" onClick={onSignOut}>
              Sign out
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
