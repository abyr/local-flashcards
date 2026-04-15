# AGENTS.md

## Project: local-flashcards

### Purpose
A fully client-side flashcard web application that:
- runs entirely in the browser
- stores all user data locally in IndexedDB via Dexie
- requires no backend
- can be deployed to GitHub Pages

The system focuses on local study workflows:
- create and organize decks
- review one card at a time
- show difficult cards more often than easy cards

---

## Current Stack

Runtime and tooling:
- Vanilla JavaScript with ES modules
- Vite
- Dexie.js

Additional tooling:
- `gh-pages` for CLI deployment

No frontend frameworks are used.

---

## Current File Structure

- `index.html` — HTML entry
- `main.js` — app bootstrap, mode switching, import/export/reset wiring, service worker registration
- `db.js` — Dexie setup plus data access, study scheduling, import/export, and statistics helpers
- `package.json` — npm scripts, dependencies, and deployment command
- `styles.css` — global app styles
- `vite.config.js` — Vite config for local dev and GitHub Pages build
- `public/sw.js` — service worker for offline caching
- `modules/cards.js` — Add Cards mode UI and CRUD interactions
- `modules/study.js` — Study mode UI, queue/session handling, keyboard controls
- `modules/ui.js` — shared UI helpers such as formatting, escaping, downloads, and notifications
- `README.md` — setup and deployment instructions

---

## Current Architecture

### `main.js`
Responsibilities:
- initializes the app shell
- owns top-level UI state for active mode and selected deck
- connects Cards, Study, and Data views
- refreshes shared statistics
- handles import/export/reset actions
- registers the service worker

### `db.js`
Responsibilities:
- defines the Dexie database and schema
- creates the default deck when needed
- stores and retrieves decks and cards
- validates and normalizes persisted data
- computes study queues
- applies review results and spaced repetition scheduling
- resets progress
- computes aggregate statistics
- imports and exports JSON snapshots

### `modules/cards.js`
Responsibilities:
- renders deck management UI
- renders card creation and editing UI
- renders the library list
- handles create/edit/delete interactions for decks and cards

### `modules/study.js`
Responsibilities:
- renders Study mode UI
- loads the current study session
- flips cards
- handles Easy/Hard actions
- attaches keyboard shortcuts

### `modules/ui.js`
Responsibilities:
- shared presentation helpers only
- HTML escaping
- date formatting
- relative time formatting
- JSON download helper
- toast notifier helper
- interactive-target detection for keyboard handling

---

## Data Model

### Deck
Stored fields:
- `id`
- `name`
- `createdAt`
- `updatedAt`

### Card
Stored fields:
- `id`
- `deckId`
- `front`
- `back`
- `difficulty`
- `lastReviewed`
- `repetitions`
- `dueAt`
- `createdAt`
- `updatedAt`

---

## Application Modes

### Add Cards
- create cards
- edit cards
- delete cards
- create decks
- rename decks
- delete decks
- validate required card and deck data
- filter library by deck

### Study
- review one card at a time
- flip front/back
- mark `Easy` or `Hard`
- reschedule cards based on difficulty and repetitions
- reintroduce hard cards more frequently
- support keyboard shortcuts

### Data
- export JSON backups
- import JSON backups
- reset study progress
- show aggregate statistics

---

## UI Requirements

- clean, minimal UI
- mobile-friendly responsive layout
- simple navigation between modes

---

## Current Rules

- fully client-side only
- no backend services
- no external APIs for app data
- all persistent user data stays in IndexedDB
- target fast load time
- async/await is used throughout the app code
- use comments where they clarify non-obvious logic
- handle empty states and validation defensively
- keep modules small and responsibilities explicit

---

## Local Run Expectation

- the project should run with `npm install && npm run dev`

---

## Offline Support

- a service worker is registered from `main.js`
- `public/sw.js` caches the app shell and same-origin assets
- the app is intended to work offline after the initial load is cached

---

## GitHub Pages

Current Vite config:
- dev base: `/`
- build base: `/local-flashcards/`

If the GitHub repository name changes, update `base` in `vite.config.js`.

---

## Guidance For Future Changes

- preserve the current module layout under `modules/`
- keep the app browser-only
- do not add a backend
- avoid frontend frameworks unless the project direction changes explicitly
- keep IndexedDB/Dexie as the local persistence layer unless a migration is intentional
