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
  /** Optional due date as a YYYY-MM-DD string, or null if none. */
  dueDate: string | null;
  /** Optional parent monthly item (launch) this task is a sub-item of. */
  monthlyItemId: string | null;
  /** ClickUp task id when this task was pulled in from ClickUp. */
  clickupId?: string;
}

export interface List {
  id: string;
  name: string;
  createdAt: string;
}

/**
 * A high-level thing to launch in a given month — the planning layer above
 * tasks. Its sub-items are ordinary tasks whose monthlyItemId points here.
 */
export interface MonthlyItem {
  id: string;
  title: string;
  /** Target month as "YYYY-MM". */
  month: string;
  /** Optional free-text notes. */
  notes: string;
  createdAt: string;
}

/** Where and what to pull from ClickUp (one-way, on demand). */
export interface ClickUpSettings {
  /** ClickUp view link (or bare view id) to pull tickets from. */
  view: string;
  /** Statuses that count as open; matched ignoring case and punctuation. */
  statuses: string[];
  /** List that new tickets land in. Null falls back to a list named "First Day". */
  listId: string | null;
}

/** User-adjustable app settings. */
export interface Settings {
  /** Suggested tags offered when tagging tasks; editable from the menu. */
  defaultTags: string[];
  clickup: ClickUpSettings;
}

/** The complete, serializable application state. */
export interface AppData {
  lists: List[];
  tasks: Task[];
  settings: Settings;
  monthlyItems: MonthlyItem[];
}

/** Tags seeded on first run; fully editable afterwards. */
export const SEED_DEFAULT_TAGS = ["work", "personal", "urgent", "errand", "idea"];

export const defaultClickUpSettings = (): ClickUpSettings => ({
  view: "https://app.clickup.com/18042215/v/b/h6kb7-32211",
  statuses: ["To Do", "In-Progress", "VQA", "QA", "READY FOR DEPLOY"],
  listId: null,
});

export const emptySettings = (): Settings => ({
  defaultTags: [...SEED_DEFAULT_TAGS],
  clickup: defaultClickUpSettings(),
});

export const emptyAppData = (): AppData => ({
  lists: [],
  tasks: [],
  settings: emptySettings(),
  monthlyItems: [],
});
