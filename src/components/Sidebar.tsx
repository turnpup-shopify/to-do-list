import { useState } from "react";
import type { List, Task } from "../types";

interface Props {
  lists: List[];
  tasks: Task[];
  activeListId: string | null;
  onSelect: (id: string) => void;
  onAddList: (name: string) => void;
  onOpenMenu: () => void;
  /** Whether the global Completed view is currently showing. */
  completedActive: boolean;
  onSelectCompleted: () => void;
  /** Mobile: whether the sidebar drawer is open. Ignored on desktop. */
  isOpen: boolean;
  /** Mobile: close the drawer (e.g. after picking a list). */
  onClose: () => void;
}

export function Sidebar({
  lists,
  tasks,
  activeListId,
  onSelect,
  onAddList,
  onOpenMenu,
  completedActive,
  onSelectCompleted,
  isOpen,
  onClose,
}: Props) {
  const [name, setName] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddList(name);
    setName("");
  };

  const select = (id: string) => {
    onSelect(id);
    onClose(); // no-op on desktop; closes the drawer on mobile
  };

  const selectCompleted = () => {
    onSelectCompleted();
    onClose();
  };

  const openCount = (listId: string) =>
    tasks.filter((t) => t.listId === listId && !t.completed).length;

  return (
    <aside className={`sidebar ${isOpen ? "sidebar--open" : ""}`}>
      <div className="sidebar__top">
        <button
          type="button"
          className="icon-btn"
          onClick={onOpenMenu}
          aria-label="Settings"
          title="Settings"
        >
          ⚙
        </button>
        <h1 className="sidebar__brand">Lists</h1>
        <button
          type="button"
          className="icon-btn sidebar__close"
          onClick={onClose}
          aria-label="Close lists"
          title="Close"
        >
          ✕
        </button>
      </div>
      <nav className="sidebar__nav">
        <button
          type="button"
          className={`list-item list-item--completed ${completedActive ? "list-item--active" : ""}`}
          onClick={selectCompleted}
        >
          <span className="list-item__name">✓ Completed</span>
        </button>
        <div className="sidebar__divider" />
        {lists.map((list) => (
          <button
            key={list.id}
            type="button"
            className={`list-item ${
              list.id === activeListId && !completedActive ? "list-item--active" : ""
            }`}
            onClick={() => select(list.id)}
          >
            <span className="list-item__name">{list.name}</span>
            <span className="list-item__count">{openCount(list.id) || ""}</span>
          </button>
        ))}
        {lists.length === 0 && <p className="sidebar__empty">No lists yet.</p>}
      </nav>
      <form className="sidebar__add" onSubmit={submit}>
        <input
          type="text"
          placeholder="New list…"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" className="btn" aria-label="Add list">
          +
        </button>
      </form>
    </aside>
  );
}
