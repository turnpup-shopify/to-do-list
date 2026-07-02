import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AppData, Task } from "../types";
import { emptyAppData } from "../types";
import { LocalStorageRepository, type Repository } from "./repository";
import * as ops from "./operations";

const defaultRepository = new LocalStorageRepository();

/**
 * Central application state hook. Loads once from the repository (running the
 * 30-day purge on the way in), then persists the whole snapshot on every change.
 * All mutations go through the pure helpers in operations.ts.
 */
export function useStore(repository: Repository = defaultRepository) {
  const [data, setData] = useState<AppData>(emptyAppData);
  const [loaded, setLoaded] = useState(false);
  const repoRef = useRef(repository);

  // Initial load + purge of stale completed tasks.
  useEffect(() => {
    let cancelled = false;
    repoRef.current.load().then((loadedData) => {
      if (cancelled) return;
      setData(ops.purgeOldCompleted(loadedData));
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist whenever state changes (after the initial load has completed).
  useEffect(() => {
    if (!loaded) return;
    void repoRef.current.save(data);
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

  return { data, loaded, actions, purge };
}
