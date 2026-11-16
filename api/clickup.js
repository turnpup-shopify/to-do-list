// ClickUp ticket pull (one-way, on demand).
//
// GET /api/clickup?view=<view link or id>&statuses=To Do,QA
//   -> { tickets: [{ id, name, status, url }], complete: boolean }
//
// Returns tasks in the given ClickUp view that are assigned to the token's
// owner and sit in one of the given statuses. Status names are matched
// ignoring case and punctuation ("In-Progress" == "in progress").
//
// POST /api/clickup  { taskId, status }
//   -> { ok: true, status }   sets a ticket's status (the only write-back).
//   The status name is matched against the ticket's list statuses the same
//   forgiving way, so "done (this sprint)" finds "DONE (THIS SPRINT)".
//
// Auth: same passphrase as /api/state. Needs CLICKUP_TOKEN (a personal API
// token, "pk_…") in the server environment.
import { checkPassphrase } from "./_lib.js";

const API = "https://api.clickup.com/api/v2";
/** Safety cap on view pages fetched per sync. */
const MAX_PAGES = 30;

const normStatus = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Accept a full view URL (…/v/b/<id>) or a bare view id. */
export function parseViewId(raw) {
  const s = String(raw || "").trim();
  const m = s.match(/\/v\/[a-z]+\/([^/?#]+)/i);
  return m ? m[1] : s;
}

async function clickup(path, token, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: token, "content-type": "application/json", ...init.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`ClickUp ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export default async function handler(req, res) {
  if (!checkPassphrase(req)) {
    return res.status(401).json({ error: "unauthorized" });
  }
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "method not allowed" });
  }

  const token = process.env.CLICKUP_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "CLICKUP_TOKEN isn't set on the server." });
  }

  if (req.method === "POST") return setStatus(req, res, token);

  const viewId = parseViewId(req.query?.view);
  const wanted = new Set(
    String(req.query?.statuses || "")
      .split(",")
      .map(normStatus)
      .filter(Boolean),
  );
  if (!viewId || wanted.size === 0) {
    return res.status(400).json({ error: "Set a ClickUp view and at least one status." });
  }

  try {
    const { user } = await clickup("/user", token);

    const tickets = [];
    // False if we hit the page cap — the client then skips auto-check-off,
    // since a missing ticket might just be on an unfetched page.
    let complete = false;
    for (let page = 0; page < MAX_PAGES; page++) {
      const data = await clickup(`/view/${encodeURIComponent(viewId)}/task?page=${page}`, token);
      for (const t of data.tasks || []) {
        const mine = (t.assignees || []).some((a) => a.id === user.id);
        if (mine && wanted.has(normStatus(t.status?.status))) {
          tickets.push({ id: t.id, name: t.name, status: t.status.status, url: t.url });
        }
      }
      if (data.last_page === true || !(data.tasks || []).length) {
        complete = true;
        break;
      }
    }

    return res.status(200).json({ tickets, complete });
  } catch (err) {
    const status = err.status === 401 ? 502 : 500;
    const message = err.status === 401 ? "ClickUp rejected CLICKUP_TOKEN." : err.message;
    return res.status(status).json({ error: message });
  }
}

async function setStatus(req, res, token) {
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const { taskId, status } = body;
  if (!taskId || !status) {
    return res.status(400).json({ error: "taskId and status are required." });
  }

  try {
    // Resolve the exact status name from the ticket's list.
    const task = await clickup(`/task/${encodeURIComponent(taskId)}`, token);
    const list = await clickup(`/list/${encodeURIComponent(task.list.id)}`, token);
    const match = (list.statuses || []).find((s) => normStatus(s.status) === normStatus(status));
    if (!match) {
      const names = (list.statuses || []).map((s) => s.status).join(", ");
      return res.status(400).json({ error: `No "${status}" status on that ticket's list. Has: ${names}` });
    }

    await clickup(`/task/${encodeURIComponent(taskId)}`, token, {
      method: "PUT",
      body: JSON.stringify({ status: match.status }),
    });
    return res.status(200).json({ ok: true, status: match.status });
  } catch (err) {
    const status = err.status === 401 ? 502 : 500;
    const message = err.status === 401 ? "ClickUp rejected CLICKUP_TOKEN." : err.message;
    return res.status(status).json({ error: message });
  }
}
