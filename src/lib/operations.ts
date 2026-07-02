import type { AppData, List, Task } from "../types";

// Pure, side-effect-free helpers that transform AppData. Keeping mutations here
// (rather than inside React components) makes the behaviour easy to test and to
// reuse in a non-React context.

export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const COMPLETED_RETENTION_DAYS = 30;

/** RFC4122-ish id. Uses crypto.randomUUID when available, falls back otherwise. */
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Normalize a raw tag string: trim, lowercase, strip a leading '#'. */
export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#/, "").toLowerCase();
}

/** Parse a comma- or space-separated tag input into clean, unique tags. */
export function parseTags(input: string): string[] {
  const seen = new Set<string>();
  for (const part of input.split(/[,\s]+/)) {
    const tag = normalizeTag(part);
    if (tag) seen.add(tag);
  }
  return [...seen];
}

/**
 * Remove tasks that were completed more than {@link COMPLETED_RETENTION_DAYS}
 * days ago. Open tasks and recently-completed tasks are always kept.
 */
export function purgeOldCompleted(data: AppData, now: number = Date.now()): AppData {
  const cutoff = now - COMPLETED_RETENTION_DAYS * MS_PER_DAY;
  const tasks = data.tasks.filter((task) => {
    if (!task.completed || !task.completedAt) return true;
    const completedTime = new Date(task.completedAt).getTime();
    if (Number.isNaN(completedTime)) return true; // keep if timestamp is unparseable
    return completedTime >= cutoff;
  });
  return tasks.length === data.tasks.length ? data : { ...data, tasks };
}

export function addList(data: AppData, name: string, now: number = Date.now()): AppData {
  const trimmed = name.trim();
  if (!trimmed) return data;
  const list: List = { id: newId(), name: trimmed, createdAt: new Date(now).toISOString() };
  return { ...data, lists: [...data.lists, list] };
}

export function renameList(data: AppData, listId: string, name: string): AppData {
  const trimmed = name.trim();
  if (!trimmed) return data;
  return {
    ...data,
    lists: data.lists.map((l) => (l.id === listId ? { ...l, name: trimmed } : l)),
  };
}

/** Delete a list and every task belonging to it. */
export function deleteList(data: AppData, listId: string): AppData {
  return {
    lists: data.lists.filter((l) => l.id !== listId),
    tasks: data.tasks.filter((t) => t.listId !== listId),
  };
}

export function addTask(
  data: AppData,
  listId: string,
  title: string,
  now: number = Date.now(),
): AppData {
  const trimmed = title.trim();
  if (!trimmed) return data;
  const task: Task = {
    id: newId(),
    listId,
    title: trimmed,
    description: "",
    tags: [],
    completed: false,
    createdAt: new Date(now).toISOString(),
    completedAt: null,
  };
  return { ...data, tasks: [task, ...data.tasks] };
}

export function updateTask(
  data: AppData,
  taskId: string,
  patch: Partial<Omit<Task, "id" | "listId" | "createdAt">>,
): AppData {
  return {
    ...data,
    tasks: data.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
  };
}

export function toggleTask(data: AppData, taskId: string, now: number = Date.now()): AppData {
  return {
    ...data,
    tasks: data.tasks.map((t) => {
      if (t.id !== taskId) return t;
      const completed = !t.completed;
      return {
        ...t,
        completed,
        completedAt: completed ? new Date(now).toISOString() : null,
      };
    }),
  };
}

export function deleteTask(data: AppData, taskId: string): AppData {
  return { ...data, tasks: data.tasks.filter((t) => t.id !== taskId) };
}

/** All distinct tags used across the given tasks, sorted alphabetically. */
export function collectTags(tasks: Task[]): string[] {
  const set = new Set<string>();
  for (const task of tasks) for (const tag of task.tags) set.add(tag);
  return [...set].sort();
}
