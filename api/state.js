// Cross-device persistence endpoint.
//
// GET  /api/state  -> returns the stored AppData JSON (or null if none yet)
// PUT  /api/state  -> overwrites the stored AppData JSON
//
// Auth: a shared passphrase in the `x-app-passphrase` header, compared against
// APP_PASSPHRASE (set it to none/false/null/unset to leave the app open).
import { STATE_KEY, checkPassphrase, getRedis } from "./_lib.js";

export default async function handler(req, res) {
  if (!checkPassphrase(req)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const redis = getRedis();
  if (!redis) {
    return res
      .status(500)
      .json({ error: "Server not configured: missing KV_REST_API_URL / KV_REST_API_TOKEN." });
  }

  try {
    if (req.method === "GET") {
      const data = await redis.get(STATE_KEY);
      return res.status(200).json(data ?? null);
    }

    if (req.method === "PUT") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      await redis.set(STATE_KEY, body);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "method not allowed" });
  } catch {
    return res.status(500).json({ error: "storage error" });
  }
}
