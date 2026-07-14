// Service worker: receives Web Push messages and shows notifications.
// Served from the site root (/sw.js) so it controls the whole app.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "To-Do", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "To-Do";
  const options = {
    body: data.body || "",
    tag: "todo-daily-digest", // collapse repeats into one
    data: { url: data.url || "/" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ("focus" in w) return w.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
