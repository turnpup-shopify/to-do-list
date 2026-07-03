import type { AppData, Task } from "../types";
import { emptyAppData, emptySettings } from "../types";

// A tiny persistence contract. Everything above this line (types, store, UI)
// is decoupled from *how* data is stored. To move between storage backends —
// localStorage, a REST API, SQLite, a file — implement this same async
// interface and swap the instance passed into the store. No other code changes.
export interface Repository {
  load(): Promise<AppData>;
  save(data: AppData): Promise<void>;
}

/** Thrown when the backend rejects the passphrase (HTTP 401). */
export class UnauthorizedError extends Error {
  constructor() {
    super("unauthorized");
    this.name = "UnauthorizedError";
  }
}

/**
 * Coerce loosely-typed stored data into a valid AppData, migrating forward so
 * data written by older versions keeps working. Shared by every repository.
 */
export function normalizeAppData(parsed: Partial<AppData> | null | undefined): AppData {
  if (!parsed) return emptyAppData();
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
}

const STORAGE_KEY = "to-do-list/v1";

/** Local-only implementation backed by the browser's localStorage. */
export class LocalStorageRepository implements Repository {
  constructor(private readonly key: string = STORAGE_KEY) {}

  async load(): Promise<AppData> {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return emptyAppData();
      return normalizeAppData(JSON.parse(raw) as Partial<AppData>);
    } catch {
      // Corrupt or unavailable storage — start clean rather than crash.
      return emptyAppData();
    }
  }

  async save(data: AppData): Promise<void> {
    localStorage.setItem(this.key, JSON.stringify(data));
  }
}

const PASSPHRASE_HEADER = "x-app-passphrase";
const DEFAULT_ENDPOINT = "/api/state";

/**
 * Cross-device implementation that talks to the serverless /api/state endpoint,
 * authenticating with a shared passphrase. The backend holds the real storage
 * credentials, so the browser only ever sends the passphrase.
 */
export class HttpRepository implements Repository {
  constructor(
    private readonly passphrase: string,
    private readonly endpoint: string = DEFAULT_ENDPOINT,
  ) {}

  async load(): Promise<AppData> {
    const res = await fetch(this.endpoint, {
      headers: { [PASSPHRASE_HEADER]: this.passphrase },
    });
    if (res.status === 401) throw new UnauthorizedError();
    if (!res.ok) throw new Error(`Failed to load (${res.status})`);
    const data = (await res.json()) as Partial<AppData> | null;
    return normalizeAppData(data);
  }

  async save(data: AppData): Promise<void> {
    const res = await fetch(this.endpoint, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        [PASSPHRASE_HEADER]: this.passphrase,
      },
      body: JSON.stringify(data),
    });
    if (res.status === 401) throw new UnauthorizedError();
    if (!res.ok) throw new Error(`Failed to save (${res.status})`);
  }
}

/** Check a passphrase against the backend. Returns false on any failure. */
export async function verifyPassphrase(
  passphrase: string,
  endpoint: string = DEFAULT_ENDPOINT,
): Promise<boolean> {
  try {
    const res = await fetch(endpoint, { headers: { [PASSPHRASE_HEADER]: passphrase } });
    return res.ok;
  } catch {
    return false;
  }
}
