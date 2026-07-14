// Daily reminder digest, invoked by Vercel Cron (see vercel.json).
//
// Reads the app state and every stored push subscription, builds a "due today
// + overdue" digest in each subscription's timezone, and delivers it via Web
// Push. Dead subscriptions (410/404) are pruned.
import webpush from "web-push";
import { STATE_KEY, SUBS_KEY, getRedis, buildDigest } from "./_lib.js";

export default async function handler(req, res) {
  // Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` for cron
  // invocations when CRON_SECRET is set. Enforce it when present.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return res.status(200).json({ ok: true, skipped: "VAPID keys not configured" });
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:reminders@example.com", publicKey, privateKey);

  const redis = getRedis();
  if (!redis) return res.status(500).json({ error: "missing KV credentials" });

  const [state, subs] = await Promise.all([redis.get(STATE_KEY), redis.get(SUBS_KEY)]);
  const subscriptions = subs || [];
  if (subscriptions.length === 0) {
    return res.status(200).json({ ok: true, sent: 0, note: "no subscriptions" });
  }

  let sent = 0;
  const survivors = [];
  for (const entry of subscriptions) {
    const digest = buildDigest(state, entry.timezone);
    if (!digest) {
      survivors.push(entry); // nothing to send, but keep the subscription
      continue;
    }
    try {
      await webpush.sendNotification(entry.subscription, JSON.stringify(digest));
      sent++;
      survivors.push(entry);
    } catch (err) {
      // 404/410 mean the subscription is gone; drop it. Keep others.
      const code = err?.statusCode;
      if (code !== 404 && code !== 410) survivors.push(entry);
    }
  }

  if (survivors.length !== subscriptions.length) {
    await redis.set(SUBS_KEY, survivors);
  }
  return res.status(200).json({ ok: true, sent });
}
