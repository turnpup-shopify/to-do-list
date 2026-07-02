import { useState } from "react";
import type { List, Task } from "../types";

interface Props {
  lists: List[];
  tasks: Task[];
  activeListId: string | null;
  onSelect: (id: string) => void;
  onAddList: (name: string) => void;
  onOpenMenu: () => void;
}

export function Sidebar({ lists, tasks, activeListId, onSelect, onAddList, onOpenMenu }: Props) {
  const [name, setName] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddList(name);
    setName("");
  };

  const openCount = (listId: string) =>
    tasks.filter((t) => t.listId === listId && !t.completed).length;

  return (
    <aside className="sidebar">
      <div className="sidebar__top">
        <button
          type="button"
          className="icon-btn"
          onClick={onOpenMenu}
          aria-label="Open menu"
          title="Menu"
        >
          ☰
        </button>
        <h1 className="sidebar__brand">Lists</h1>
      </div>
      <nav className="sidebar__nav">
        {lists.map((list) => (
          <button
            key={list.id}
            type="button"
            className={`list-item ${list.id === activeListId ? "list-item--active" : ""}`}
            onClick={() => onSelect(list.id)}
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
