// Manage this browser's Web Push subscription.
//
// POST   /api/subscribe  { subscription, timezone }  -> store (upsert by endpoint)
// DELETE /api/subscribe  { endpoint }                -> remove
//
// Subscriptions are kept as an array in KV; a single user may have several
// (one per device/browser). Authenticated with the same shared passphrase.
import { SUBS_KEY, checkPassphrase, getRedis } from "./_lib.js";

export default async function handler(req, res) {
  if (!checkPassphrase(req)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const redis = getRedis();
  if (!redis) {
    return res.status(500).json({ error: "Server not configured: missing KV credentials." });
  }

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const existing = (await redis.get(SUBS_KEY)) || [];

  try {
    if (req.method === "POST") {
      const { subscription, timezone } = body;
      if (!subscription?.endpoint) {
        return res.status(400).json({ error: "missing subscription" });
      }
      const others = existing.filter((s) => s.subscription?.endpoint !== subscription.endpoint);
      others.push({ subscription, timezone: timezone || "UTC" });
      await redis.set(SUBS_KEY, others);
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const endpoint = body.endpoint;
      const remaining = existing.filter((s) => s.subscription?.endpoint !== endpoint);
      await redis.set(SUBS_KEY, remaining);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "POST, DELETE");
    return res.status(405).json({ error: "method not allowed" });
  } catch {
    return res.status(500).json({ error: "storage error" });
  }
}
