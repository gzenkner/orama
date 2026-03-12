# Orama

Outcome-based planning that breaks down into **monthly → weekly → daily** slices, with a full-year consistency calendar.

## Run locally

```bash
cd orama
npm install
npm run dev
```

Then open the URL Vite prints (default: `http://localhost:5173`).

## Run without the dev server

```bash
cd orama
npm run build
```

This creates a production build in `dist/`.

- To deploy on the web, upload the contents of `dist/` to any static host.
- To test the production build locally, run `npm run preview`.
- To package it as a desktop app later with Tauri or Electron, use the files in `dist/`. The Vite build is configured with relative asset paths so it can be loaded from disk instead of requiring the dev server.

## Build for macOS (Tauri)

This repo is already configured as a Tauri desktop app.

### One-time setup on a Mac

Install Apple's command line tools:

```bash
xcode-select --install
```

Install Rust if you do not already have it:

```bash
curl https://sh.rustup.rs -sSf | sh
```

Then install JavaScript dependencies:

```bash
cd orama
npm install
```

### Run the desktop app in development

```bash
cd orama
npm run tauri:dev
```

### Build the macOS app bundle

```bash
cd orama
npm run tauri:build
```

Tauri will build the frontend first and then create the macOS app bundle.

The built `.app` should be created at:

```text
src-tauri/target/release/bundle/macos/Orama.app
```

Notes:

- The current Tauri config is set to build the `app` bundle target, not a DMG installer.
- The bundle identifier is `com.gabrielzenkner.orama`.
- If macOS blocks opening the unsigned app, use Finder's "Open" action or remove quarantine on your own machine before testing.

## How it works

- Create an **Outcome** (required date range).
- The **Plan** tab shows every **calendar month** in the range.
- Each month contains **calendar weeks** (Sunday/Monday start selectable).
- Each week contains the **days in that month/week**, where you can set a daily commitment and mark it done.
- The **Calendar** tab shows a **full year** view highlighting consistency (done / planned / unplanned).

## Data

- Stored locally in your browser via `localStorage`.
- Use **Backup** to export/import JSON.
