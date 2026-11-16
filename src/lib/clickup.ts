import type { ClickUpSettings } from "../types";
import type { ClickUpTicket } from "./operations";
import { UnauthorizedError } from "./repository";

/** Pull open ClickUp tickets assigned to the token's owner via /api/clickup. */
export async function fetchClickUpTickets(
  settings: ClickUpSettings,
  passphrase: string,
): Promise<{ tickets: ClickUpTicket[]; complete: boolean }> {
  const params = new URLSearchParams({ view: settings.view, statuses: settings.statuses.join(",") });
  const res = await fetch(`/api/clickup?${params}`, {
    headers: { "x-app-passphrase": passphrase },
  });
  if (res.status === 401) throw new UnauthorizedError();
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `ClickUp sync failed (${res.status})`);
  return { tickets: body.tickets ?? [], complete: body.complete !== false };
}

/** Set a ClickUp ticket's status — the app's only write-back to ClickUp. */
export async function setClickUpStatus(taskId: string, status: string, passphrase: string): Promise<void> {
  const res = await fetch("/api/clickup", {
    method: "POST",
    headers: { "content-type": "application/json", "x-app-passphrase": passphrase },
    body: JSON.stringify({ taskId, status }),
  });
  if (res.status === 401) throw new UnauthorizedError();
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `ClickUp update failed (${res.status})`);
}
