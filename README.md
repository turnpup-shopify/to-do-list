# To-Do

A minimal, fast, multi-list to-do app built with React + TypeScript + Vite.
Data syncs **across devices** through a tiny serverless backend (Vercel + a
Redis KV store), gated by a single shared passphrase.

## Features

- **Cross-device sync** — your lists live in a cloud KV store and follow you to
  any browser/device. Unlock with a shared passphrase.
- **Multiple lists** — organize tasks into as many lists as you like, switch
  instantly from the sidebar (each shows its open-task count).
- **Minimal rows** — compact one-line rows with a checkbox to check things off.
- **Modern glass UI** — frosted, translucent panels with rounded corners over a
  soft gradient; light & dark themes follow your system.
- **Drag-and-drop reordering** — grab the handle (`⠿`) on any row to reorder
  tasks within a list. Order is persisted.
- **Task details** — click any row to expand it. Each task stores:
  - a **created date** and a **completed date** (set automatically when checked),
  - an optional **due date** (overdue dates are highlighted in the row),
  - an optional **description** where any `http(s)` links are auto-clickable,
  - **tags** (comma/space separated) for organizing.
- **Tags with smart suggestions** — a set of default tags is suggested as
  one-click chips when tagging a task. Edit that default set anytime from the
  **hamburger menu** (☰) in the sidebar.
- **Tag filtering** — click tag chips above a list to filter to tasks matching
  all selected tags. Toggle completed tasks in/out of view.
- **Completed view** — a dedicated "✓ Completed" view (in the sidebar) lists
  everything you've finished across all lists, newest-first, with a switch to
  group by week, by month, or not at all. (Shows the last 365 days — see
  auto-cleanup below.)
- **Daily reminders (opt-in)** — turn on push notifications from the settings
  panel to get one notification each morning listing what's due today plus
  anything overdue.
- **Auto-cleanup** — tasks completed more than **365 days** ago are automatically
  deleted on load, so the app stays lean.

## Deploying to Vercel (one-time setup)

The app is a Vite static frontend plus one serverless function (`api/state.js`).
Vercel builds and hosts both, and auto-deploys on every push to `main`.

1. **Import the repo into Vercel** — New Project → import this GitHub repo.
   Vercel auto-detects Vite (build `npm run build`, output `dist/`). No config
   needed.
2. **Add a KV store** — in the project's **Storage** tab, create an
   **Upstash for Redis** (KV) store and connect it to the project. This injects
   `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.
3. **Set the passphrase** — Project → **Settings → Environment Variables** →
   add `APP_PASSPHRASE` = a secret only you know.
4. **Redeploy** (Deployments → ⋯ → Redeploy) so the new env vars take effect.

Open the deployment, enter your passphrase, and you're in. Enter the same
passphrase on any other device to see the same lists.

### Reminders (Web Push) — optional

A daily digest of tasks due today/overdue can be pushed as a notification.

1. **Generate VAPID keys:** `npx web-push generate-vapid-keys`.
2. **Add env vars** (Settings → Environment Variables):
   - `VAPID_PUBLIC_KEY` and `VITE_VAPID_PUBLIC_KEY` — both set to the **public** key.
   - `VAPID_PRIVATE_KEY` — the private key.
   - `VAPID_SUBJECT` — `mailto:you@example.com`.
   - `CRON_SECRET` — any long random string (Vercel sends it to the cron job).
3. **Redeploy**, open the app, and toggle **Reminders → on** in the settings
   panel (☰ → ⚙). Grant the notification permission when asked.

The schedule lives in `vercel.json` (`0 13 * * *`, i.e. 13:00 UTC daily) — edit
it to suit your timezone. Note: Vercel's free Hobby plan runs cron **once per
day**; more frequent reminders need the Pro plan.

**On iPhone/iPad**, Safari only delivers Web Push to an installed PWA: open the
site, tap Share → **Add to Home Screen**, then enable reminders from that icon.

> Security note: the KV credentials live only in the serverless function's
> environment — they're never sent to the browser. The browser only holds the
> passphrase, which is checked server-side on every request over HTTPS. Writes
> are last-write-wins, which is fine for a single user editing one device at a
> time.

## Local development

```bash
npm install
npm run build     # type-check + produce a static build in dist/
```

For a live backend locally, run `vercel dev` (needs the Vercel CLI and the env
vars above). Plain `npm run dev` serves the UI, but calls to `/api/state` only
work where the function is running (i.e. on Vercel or under `vercel dev`).

## Architecture — built to be portable

The code is deliberately layered so it's easy to swap storage or even frameworks:

| Layer | File(s) | Responsibility |
| --- | --- | --- |
| **Domain model** | `src/types.ts` | Plain, framework-agnostic types (`Task`, `List`, `Settings`, `AppData`). |
| **Operations** | `src/lib/operations.ts` | Pure functions that transform state (add/toggle/delete, reorder, the retention purge, tag parsing, default-tag editing). No React, no storage — trivially testable and reusable. |
| **Persistence** | `src/lib/repository.ts` | A small async `Repository` interface with two implementations: `HttpRepository` (the backend) and `LocalStorageRepository` (offline/standalone). |
| **Backend** | `api/state.js`, `api/subscribe.js`, `api/cron.js`, `api/_lib.js` | Serverless `GET`/`PUT` of the state blob, push-subscription storage, the daily reminder cron, and shared helpers — all guarded by the passphrase. |
| **Service worker** | `public/sw.js` | Receives Web Push messages and shows notifications. |
| **State** | `src/lib/useStore.ts` | A React hook wiring operations to the repository, with debounced saves. |
| **UI** | `src/App.tsx`, `src/components/*` | Presentation only (incl. the passphrase gate). |

**Swapping storage** (a different DB, REST/GraphQL API, SQLite, a file, …):
implement the `Repository` interface — `load(): Promise<AppData>` and
`save(data): Promise<void>` — and pass your instance into `useStore()`. Nothing
above the persistence layer changes. (Want a purely offline build with no
backend? Use the included `LocalStorageRepository`.)

**Swapping UI framework**: the domain types and `operations.ts` are plain
TypeScript with no dependencies, so they port as-is; only the components need
rewriting.

## Data

State is a single JSON object (`{ lists, tasks, settings }`) stored under one
key in the KV store, so it's easy to export, back up, or migrate. The loader
migrates older shapes forward, so data keeps working across versions.
