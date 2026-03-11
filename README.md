# Goals App

Outcome-based planning that breaks down into **monthly → weekly → daily** slices, with a full-year consistency calendar.

## Run locally

```bash
cd goals_app
npm install
npm run dev
```

Then open the URL Vite prints (default: `http://localhost:5173`).

## Run without the dev server

```bash
cd goals_app
npm run build
```

This creates a production build in `dist/`.

- To deploy on the web, upload the contents of `dist/` to any static host.
- To test the production build locally, run `npm run preview`.
- To package it as a desktop app later with Tauri or Electron, use the files in `dist/`. The Vite build is configured with relative asset paths so it can be loaded from disk instead of requiring the dev server.

## How it works

- Create an **Outcome** (required date range).
- The **Plan** tab shows every **calendar month** in the range.
- Each month contains **calendar weeks** (Sunday/Monday start selectable).
- Each week contains the **days in that month/week**, where you can set a daily commitment and mark it done.
- The **Calendar** tab shows a **full year** view highlighting consistency (done / planned / unplanned).

## Data

- Stored locally in your browser via `localStorage`.
- Use **Backup** to export/import JSON.

# orama
