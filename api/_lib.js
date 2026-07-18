// Shared helpers for the serverless functions. Files prefixed with "_" are not
// treated as routes by Vercel.
import { Redis } from "@upstash/redis";

export const STATE_KEY = "todo-app/state";
export const SUBS_KEY = "todo-app/push-subs";

// APP_PASSPHRASE values that mean "no passphrase — leave the app open".
const DISABLED = new Set(["", "none", "false", "null"]);

export function authRequired() {
  const p = process.env.APP_PASSPHRASE;
  if (p === undefined || p === null) return false;
  return !DISABLED.has(p.trim().toLowerCase());
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

/** True if the request carries a valid passphrase (or none is required). */
export function checkPassphrase(req) {
  if (!authRequired()) return true;
  const provided = req.headers["x-app-passphrase"];
  return safeEqual(typeof provided === "string" ? provided : "", process.env.APP_PASSPHRASE);
}

export function getRedis() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/** Local calendar date ("YYYY-MM-DD") in the given IANA timezone. */
export function localDate(timezone, now = Date.now()) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(now));
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(now));
  }
}

/**
 * Build the reminder digest for the given app state and timezone, or null if
 * there's nothing due today or overdue. Pure — safe to unit test.
 */
export function buildDigest(state, timezone, now = Date.now()) {
  const today = localDate(timezone, now);
  const open = (state?.tasks || []).filter((t) => t && !t.completed && t.dueDate);
  const dueToday = open.filter((t) => t.dueDate === today);
  const overdue = open.filter((t) => t.dueDate < today);
  if (dueToday.length === 0 && overdue.length === 0) return null;

  const parts = [];
  if (dueToday.length) parts.push(`${dueToday.length} due today`);
  if (overdue.length) parts.push(`${overdue.length} overdue`);
  const names = [...dueToday, ...overdue].slice(0, 5).map((t) => `• ${t.title}`);
  if (dueToday.length + overdue.length > 5) names.push("…");

  return {
    title: `To-Do — ${parts.join(", ")}`,
    body: names.join("\n"),
    url: "/",
  };
}
