# Orama

Orama is a local-first planning app for people who think in outcomes, not loose to-do lists.

It helps you take one concrete finish line, map it across months, break it into weeks, and turn it into small daily commitments you can actually complete. The result is a planning system that feels structured without becoming heavy.

## Why Use Orama?

Most planning tools fail in one of two ways:

- They stay too high-level, so your goals never turn into real weekly or daily action.
- They get too granular too fast, so you end up managing tasks instead of moving toward something meaningful.

Orama sits in the middle.

You start with an **outcome** with a date range. From there, Orama gives you a clean path from the big picture down to today:

- **Months** define the major focus.
- **Weeks** turn that focus into a shorter push.
- **Days** stay small enough to finish, even when life is busy.

If you have ever felt like your planning system looked organized but still did not help you make progress, Orama is built for that exact gap.

## What Makes It Different

- **Outcome-first planning**  
  Everything starts with a clear finish line, not an endless inbox.

- **Month → week → day structure**  
  Plans stay connected. Daily work is always traceable back to the larger goal.

- **A real consistency view**  
  The calendar makes it obvious where you are showing up, where you are planning well, and where the system is slipping.

- **Local-first by default**  
  Your data stays on your machine in local storage, with import/export backup built in.

- **Optional AI-assisted monthly planning**  
  The `Studio` workspace can suggest monthly milestones for an outcome using a local Ollama model, so you can get help shaping the plan without shipping your data to a remote service.

## How Orama Works

### 1. Create an outcome

Define something time-bound and concrete.

Examples:

- Launch a new product landing page by June
- Run a sub-4 marathon this autumn
- Reach conversational fluency in Spanish over 6 months

### 2. Shape the plan

Use the `Plan` view to define the focus for each month, then break each month into weekly goals.

This creates a planning ladder instead of disconnected notes.

### 3. Keep daily commitments small

Daily entries are meant to be realistic. The app is most useful when each day feels finishable, not aspirational.

### 4. Review consistency over time

The `Calendar` view gives you a full-range signal on whether your plan is being executed:

- `Done`
- `Planned`
- `Unplanned`

This makes drift visible early, before an entire month disappears.

## Workspace Overview

### Overview

See the current state of an outcome at a glance, including what matters now and where today fits into the broader plan.

### Plan

Map an outcome across calendar months, weeks, and active days. This is the core planning surface.

### Studio

Generate monthly milestone suggestions for an outcome with a local Ollama model, review them, and apply them into the plan.

### Calendar

Audit consistency across the full range of the outcome with a year-style view.

### Settings

Switch theme mode, change the week start day, and backup or restore your data.

## Who It Is For

Orama is especially useful if you:

- work toward long-running goals and want more structure than a notes app
- dislike bloated project-management software
- want a personal planning tool that stays readable over months
- prefer local tools and simple data ownership
- like the idea of AI assistance, but only if it can run locally

## Local-First Data

Orama stores data locally in your browser via `localStorage`.

You can also export and import your data through the built-in backup tools in `Settings`.

## Run Locally

### Web app

```bash
cd orama
npm install
npm run dev
```

Then open the URL printed by Vite, usually:

```text
http://localhost:5173
```

### Production web build

```bash
cd orama
npm run build
```

This creates a production build in `dist/`.

Useful follow-ups:

- `npm run preview` to serve the production build locally
- deploy `dist/` to any static host

## Desktop App (Tauri)

This repository is already configured to run as a Tauri desktop app.

### One-time setup on macOS

Install Apple command line tools:

```bash
xcode-select --install
```

Install Rust if needed:

```bash
curl https://sh.rustup.rs -sSf | sh
```

Install JavaScript dependencies:

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

The built app should be created at:

```text
src-tauri/target/release/bundle/macos/Orama.app
```

Notes:

- The current Tauri config builds an `.app` bundle, not a DMG installer.
- The bundle identifier is `com.gabrielzenkner.orama`.
- If macOS blocks the unsigned app, use Finder's `Open` action or remove quarantine on your own machine before testing.

## AI Planning With Ollama

The `Studio` view can use a local Ollama model to suggest monthly milestones for an outcome.

This is optional, but useful when you want help turning a broad objective into a month-by-month sequence.

If you want to use it:

1. Install and run Ollama on your machine.
2. Pull a compatible local model.
3. Open `Studio` inside Orama and generate suggestions.

Orama is designed to work without this feature as well.

## Philosophy

Orama is opinionated in a simple way:

- start with a meaningful outcome
- make every layer of planning connect to the one above it
- keep daily work small enough to finish
- review consistency instead of relying on motivation

That combination is what makes the app useful.

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Tauri
- Ollama for optional local AI assistance

## Status

Orama is already usable as a personal planning tool and desktop app. The product direction is clear: thoughtful planning, local ownership, and less noise than conventional productivity software.
