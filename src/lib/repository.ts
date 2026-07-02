import type { AppData, Task } from "../types";
import { emptyAppData, emptySettings } from "../types";

// A tiny persistence contract. Everything above this line (types, store, UI)
// is decoupled from *how* data is stored. To move off the browser — e.g. to a
// REST/GraphQL backend, SQLite, or a file — implement this same async interface
// and swap the instance passed into the store. No other code needs to change.
export interface Repository {
  load(): Promise<AppData>;
  save(data: AppData): Promise<void>;
}

const STORAGE_KEY = "to-do-list/v1";

/** Default implementation backed by the browser's localStorage. */
export class LocalStorageRepository implements Repository {
  constructor(private readonly key: string = STORAGE_KEY) {}

  async load(): Promise<AppData> {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return emptyAppData();
      const parsed = JSON.parse(raw) as Partial<AppData>;
      // Migrate forward: ensure newer fields exist on data saved by older versions.
      const tasks: Task[] = Array.isArray(parsed.tasks)
        ? parsed.tasks.map((t) => ({ ...t, dueDate: t.dueDate ?? null }))
        : [];
      return {
        lists: Array.isArray(parsed.lists) ? parsed.lists : [],
        tasks,
        settings: parsed.settings?.defaultTags
          ? { defaultTags: parsed.settings.defaultTags }
          : emptySettings(),
      };
    } catch {
      // Corrupt or unavailable storage — start clean rather than crash.
      return emptyAppData();
    }
  }

  async save(data: AppData): Promise<void> {
    localStorage.setItem(this.key, JSON.stringify(data));
  }
}
