// Vercel serverless function backing cross-device persistence.
//
// GET  /api/state  -> returns the stored AppData JSON (or null if none yet)
// PUT  /api/state  -> overwrites the stored AppData JSON
//
// Auth: a single shared passphrase sent in the `x-app-passphrase` header is
// compared against the APP_PASSPHRASE env var. The storage credentials never
// leave the server, so the browser only ever holds the passphrase.
//
// Storage: an Upstash Redis (a.k.a. Vercel KV) store, holding the whole app
// state under one key. Fine for a single-user app; writes are last-write-wins.

import { Redis } from "@upstash/redis";

const KEY = "todo-app/state";

function getRedis() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

// Length-aware constant-time-ish comparison to avoid trivial timing leaks.
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export default async function handler(req, res) {
  const expected = process.env.APP_PASSPHRASE;
  if (!expected) {
    return res.status(500).json({ error: "Server not configured: set the APP_PASSPHRASE env var." });
  }

  const provided = req.headers["x-app-passphrase"];
  if (!safeEqual(typeof provided === "string" ? provided : "", expected)) {
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
      const data = await redis.get(KEY); // parsed object, or null if unset
      return res.status(200).json(data ?? null);
    }

    if (req.method === "PUT") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      await redis.set(KEY, body);
      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "method not allowed" });
  } catch {
    return res.status(500).json({ error: "storage error" });
  }
}
