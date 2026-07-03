import { useState } from "react";

interface Props {
  open: boolean;
  defaultTags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  onClose: () => void;
  onSignOut: () => void;
}

/** Slide-in panel for adjusting default tags and signing out. */
export function SettingsMenu({ open, defaultTags, onAdd, onRemove, onClose, onSignOut }: Props) {
  const [draft, setDraft] = useState("");

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

        <section className="panel__section">
          <h3>Account</h3>
          <p className="panel__hint">Your data syncs across devices via the shared passphrase.</p>
          <button type="button" className="btn btn--danger" onClick={onSignOut}>
            Sign out
          </button>
        </section>
      </div>
    </div>
  );
}
