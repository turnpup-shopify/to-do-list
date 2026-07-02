# To-Do

A minimal, fast, multi-list to-do app. Built with React + TypeScript + Vite,
it runs as a standalone static web app with **no backend** — all data lives in
your browser's `localStorage`.

## Features

- **Multiple lists** — organize tasks into as many lists as you like, switch
  instantly from the sidebar (each shows its open-task count).
- **Minimal rows** — compact one-line rows with a checkbox to check things off.
- **Task details** — click any row to expand it. Each task stores:
  - a **created date** and a **completed date** (set automatically when checked),
  - an optional **description** where any `http(s)` links are auto-clickable,
  - **tags** (comma/space separated) for organizing.
- **Tag filtering** — click tag chips above a list to filter to tasks matching
  all selected tags. Toggle completed tasks in/out of view.
- **Auto-cleanup** — tasks completed more than **30 days** ago are automatically
  deleted on load, so the app stays lean.
- **Light & dark** — follows your system color scheme.

## Getting started

```bash
npm install
npm run dev       # start the dev server (http://localhost:5173)
npm run build     # type-check + produce a static build in dist/
npm run preview   # serve the production build locally
```

### Deploying

`npm run build` emits a fully static site to `dist/`. It uses a **relative
base path**, so you can host it anywhere — Netlify, Vercel, GitHub Pages, S3,
or any static file server — including from a subpath, with no configuration.

## Architecture — built to be portable

The code is deliberately layered so it's easy to move to a different framework
or a real backend later:

| Layer | File(s) | Responsibility |
| --- | --- | --- |
| **Domain model** | `src/types.ts` | Plain, framework-agnostic types (`Task`, `List`, `AppData`). |
| **Operations** | `src/lib/operations.ts` | Pure functions that transform state (add/toggle/delete, the 30-day purge, tag parsing). No React, no storage — trivially testable and reusable. |
| **Persistence** | `src/lib/repository.ts` | A small async `Repository` interface with a `localStorage` implementation. |
| **State** | `src/lib/useStore.ts` | A React hook wiring operations to the repository. |
| **UI** | `src/App.tsx`, `src/components/*` | Presentation only. |

**Moving to another storage backend** (REST/GraphQL API, SQLite, a file, …):
implement the `Repository` interface — `load(): Promise<AppData>` and
`save(data): Promise<void>` — and pass your instance to `useStore()`. Nothing
above the persistence layer changes.

**Moving to another UI framework**: the domain types and `operations.ts` are
plain TypeScript with no dependencies, so they port as-is; only the components
need rewriting.

## Data

All state is serialized under the `to-do-list/v1` key in `localStorage`. It's a
single JSON object (`{ lists, tasks }`), so it's easy to export, back up, or
migrate.
