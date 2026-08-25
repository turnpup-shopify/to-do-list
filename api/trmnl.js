// TRMNL custom plugin endpoint.
//
// GET /api/trmnl?token=xxx -> returns incomplete tasks grouped by list as JSON
//
// Auth: query param `token` compared against TRMNL_TOKEN env var.
// If TRMNL_TOKEN is unset, the endpoint is open (like APP_PASSPHRASE behavior).
import { STATE_KEY, getRedis } from "./_lib.js";

function checkToken(req) {
  const expected = process.env.TRMNL_TOKEN;
  if (!expected || expected === "none" || expected === "false") return true;
  const provided = req.query?.token || "";
  if (provided.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++)
    mismatch |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method not allowed" });
  }

  if (!checkToken(req)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const redis = getRedis();
  if (!redis) {
    return res
      .status(500)
      .json({ error: "Server not configured: missing KV_REST_API_URL / KV_REST_API_TOKEN." });
  }

  try {
    const state = await redis.get(STATE_KEY);
    const lists = state?.lists || [];
    const tasks = state?.tasks || [];

    const today = new Date().toISOString().slice(0, 10);
    const incomplete = tasks.filter((t) => t && !t.completed);

    // Group tasks by list
    const listMap = Object.fromEntries(lists.map((l) => [l.id, l.name]));
    const grouped = {};
    for (const task of incomplete) {
      const listName = listMap[task.listId] || "Unknown";
      if (!grouped[listName]) grouped[listName] = [];
      grouped[listName].push({
        title: task.title,
        due: task.dueDate || null,
        overdue: task.dueDate ? task.dueDate < today : false,
        tags: task.tags,
      });
    }

    // Sort tasks within each list: overdue first, then by due date, then undated
    for (const listName of Object.keys(grouped)) {
      grouped[listName].sort((a, b) => {
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        if (a.due && b.due) return a.due.localeCompare(b.due);
        if (a.due) return -1;
        if (b.due) return 1;
        return 0;
      });
    }

    return res.status(200).json({
      total: incomplete.length,
      lists: grouped,
    });
  } catch {
    return res.status(500).json({ error: "storage error" });
  }
}
