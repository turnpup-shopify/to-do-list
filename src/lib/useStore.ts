import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppData, Task } from "../types";
import { emptyAppData } from "../types";
import { UnauthorizedError, type Repository } from "./repository";
import * as ops from "./operations";

/** Delay before persisting a change, so bursts of edits collapse into one save. */
const SAVE_DEBOUNCE_MS = 700;

interface Options {
  /** Called when the backend rejects the passphrase (on load or save). */
  onUnauthorized?: () => void;
}

/**
 * Central application state hook. Loads once from the repository (running the
 * retention purge on the way in), then persists the whole snapshot on every change
 * — debounced, since the repository may be a remote endpoint. All mutations go
 * through the pure helpers in operations.ts.
 */
export function useStore(repository: Repository, opts: Options = {}) {
  const [data, setData] = useState<AppData>(emptyAppData);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const repoRef = useRef(repository);
  repoRef.current = repository;
  const onUnauthorizedRef = useRef(opts.onUnauthorized);
  onUnauthorizedRef.current = opts.onUnauthorized;

  // Load (and re-load if the repository instance changes, e.g. new passphrase).
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    repository
      .load()
      .then((loadedData) => {
        if (cancelled) return;
        setData(ops.purgeOldCompleted(loadedData));
        setError(null);
        setLoaded(true);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof UnauthorizedError) onUnauthorizedRef.current?.();
        else setError("Couldn't load your data — check your connection.");
      });
    return () => {
      cancelled = true;
    };
  }, [repository]);

  // Persist changes after the initial load, debounced.
  useEffect(() => {
    if (!loaded) return;
    const id = setTimeout(() => {
      repoRef.current.save(data).then(
        () => setError(null),
        (err) => {
          if (err instanceof UnauthorizedError) onUnauthorizedRef.current?.();
          else setError("Couldn't sync — will retry on your next change.");
        },
      );
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [data, loaded]);

  const actions = useMemo(
    () => ({
      addList: (name: string) => setData((d) => ops.addList(d, name)),
      renameList: (id: string, name: string) => setData((d) => ops.renameList(d, id, name)),
      deleteList: (id: string) => setData((d) => ops.deleteList(d, id)),
      addTask: (listId: string, title: string) => setData((d) => ops.addTask(d, listId, title)),
      updateTask: (id: string, patch: Partial<Omit<Task, "id" | "listId" | "createdAt">>) =>
        setData((d) => ops.updateTask(d, id, patch)),
      toggleTask: (id: string) => setData((d) => ops.toggleTask(d, id)),
      deleteTask: (id: string) => setData((d) => ops.deleteTask(d, id)),
      reorderTasks: (draggedId: string, targetId: string) =>
        setData((d) => ops.reorderTasks(d, draggedId, targetId)),
      addDefaultTag: (tag: string) => setData((d) => ops.addDefaultTag(d, tag)),
      removeDefaultTag: (tag: string) => setData((d) => ops.removeDefaultTag(d, tag)),
    }),
    [],
  );

  const purge = useCallback(() => setData((d) => ops.purgeOldCompleted(d)), []);

  return { data, loaded, error, actions, purge };
}
