import type { Task } from "../types";

export type GroupMode = "none" | "week" | "month";

export interface TaskGroup {
  key: string;
  label: string;
  items: Task[];
}

const monthFmt = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const dayFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

/** Local Monday 00:00 of the week containing `d`. */
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const mondayOffset = (x.getDay() + 6) % 7; // Sun=6 … Mon=0
  x.setDate(x.getDate() - mondayOffset);
  return x;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Group completed tasks (already sorted newest-first) by the chosen period.
 * Returns groups ordered newest-first; items within each group keep their order.
 * With mode "none", returns a single unlabeled group containing everything.
 */
export function groupCompleted(tasks: Task[], mode: GroupMode): TaskGroup[] {
  if (mode === "none") {
    return tasks.length ? [{ key: "all", label: "", items: tasks }] : [];
  }

  const groups = new Map<string, TaskGroup>();
  for (const t of tasks) {
    if (!t.completedAt) continue;
    const d = new Date(t.completedAt);
    if (Number.isNaN(d.getTime())) continue;

    let key: string;
    let label: string;
    if (mode === "month") {
      key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      label = monthFmt.format(d);
    } else {
      const start = startOfWeek(d);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      key = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
      label = `${dayFmt.format(start)} – ${dayFmt.format(end)}`;
    }

    let group = groups.get(key);
    if (!group) {
      group = { key, label, items: [] };
      groups.set(key, group);
    }
    group.items.push(t);
  }

  // Keys are zero-padded date strings, so lexical desc == chronological desc.
  return [...groups.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}
