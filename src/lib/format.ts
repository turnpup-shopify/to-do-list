// Small date-formatting helpers shared across components.

const dateFmt = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const dateTimeFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dateFmt.format(d);
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dateTimeFmt.format(d);
}

const dueFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

/** Local "today" as a YYYY-MM-DD string, matching <input type="date"> values. */
export function todayISODate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Short, human label for a YYYY-MM-DD due date (parsed as local time). */
export function formatDueDate(date: string | null): string {
  if (!date) return "";
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "" : dueFmt.format(d);
}

/** True when a due date is strictly before today. */
export function isOverdue(date: string | null): boolean {
  return !!date && date < todayISODate();
}
