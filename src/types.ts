// Domain model — deliberately framework- and storage-agnostic.
// These plain types are the contract the rest of the app is built on, so the
// model can be reused as-is if the UI or persistence layer is ever swapped out.

export interface Task {
  id: string;
  listId: string;
  title: string;
  /** Optional free-text notes. URLs are auto-linked when rendered. */
  description: string;
  /** Lowercased, de-duplicated labels used for filtering. */
  tags: string[];
  completed: boolean;
  /** ISO-8601 timestamp of when the task was created. */
  createdAt: string;
  /** ISO-8601 timestamp of when it was checked off, or null while open. */
  completedAt: string | null;
}

export interface List {
  id: string;
  name: string;
  createdAt: string;
}

/** The complete, serializable application state. */
export interface AppData {
  lists: List[];
  tasks: Task[];
}

export const emptyAppData = (): AppData => ({ lists: [], tasks: [] });
