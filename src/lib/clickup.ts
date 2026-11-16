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
