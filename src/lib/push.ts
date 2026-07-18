import { getPassphrase } from "./auth";

// Web Push subscription management. The VAPID public key is injected at build
// time; when it's absent, reminders are simply reported as unavailable.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

/** Whether this browser can support Web Push and the app is configured for it. */
export function pushSupported(): boolean {
  return (
    !!VAPID_PUBLIC_KEY &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register("/sw.js");
}

/** True if this browser currently has an active push subscription. */
export async function isSubscribed(): Promise<boolean> {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return false;
  return !!(await reg.pushManager.getSubscription());
}

const headers = () => ({
  "content-type": "application/json",
  "x-app-passphrase": getPassphrase(),
});

/**
 * Ask for permission, subscribe, and register the subscription with the
 * backend. Returns the resulting Notification permission state.
 */
export async function enableReminders(): Promise<NotificationPermission> {
  if (!pushSupported()) return "denied";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission;

  const reg = await registration();
  await navigator.serviceWorker.ready;
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
    }));

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  await fetch("/api/subscribe", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ subscription, timezone }),
  });
  return "granted";
}

/** Unsubscribe this browser and tell the backend to forget it. */
export async function disableReminders(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch("/api/subscribe", {
      method: "DELETE",
      headers: headers(),
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => {});
    await sub.unsubscribe();
  }
}
