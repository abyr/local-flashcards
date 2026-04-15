# Local Flashcards User Manual

## Overview

Local Flashcards is a browser-only study app. All decks, cards, and review progress are stored locally in your browser with IndexedDB. No backend is used.

The app has three pages:

1. Cards
2. Library
3. Progress

The header also shows top summary tiles:

- Decks: total number of decks
- Cards: total number of cards
- Due: total number of cards currently due
- Learned: total number of learned cards

## Cards Page

The Cards page is the study page. It is used for reviewing one card at a time.

### Section: Review One Card at a Time

This section contains:

- Deck selector: study all decks or one specific deck
- Session summary tiles:
  - Cards in queue
  - Due now
  - Learned
  - Reviewed today
- Refresh queue button: rebuilds the current study queue

### Section: Flashcard

This section contains:

- Current card front
- Current card back after flipping
- Due label on the card shell
- Flip card button
- Hard button
- Easy button
- Keyboard hint text

### Study Flow

1. Select a deck or keep `All decks`.
2. Open the first card in the queue.
3. Flip the card.
4. Mark it `Hard` or `Easy`.
5. The app reschedules the card and moves to the next one.

### Keyboard Shortcuts

- `Space`: flip card
- `ArrowLeft`: mark `Hard`
- `ArrowRight`: mark `Easy`

## Library Page

The Library page combines backup tools, deck management, card creation, and card editing.

### Section: Import or Export Your Decks

This section contains:

- Export JSON: downloads a full backup of all decks and cards
- Import JSON: imports a backup file into local storage

Import behavior:

- Decks are matched by deck name
- Existing deck names are reused
- New deck names are created
- Imported cards are appended locally

### Section: Organize Your Decks

This section contains:

- New deck name field
- Add deck button
- Deck list

Each deck card shows:

- Deck name
- Number of cards
- Number of due cards
- Rename button
- Delete button

Selecting a deck also updates the active filter for cards and study.

### Section: Create a New Card / Edit Card

This section contains:

- Deck selector
- Front field
- Back field
- Save card button
- Cancel edit button when editing an existing card

Rules:

- Front is required
- Back is required
- A valid deck is required

### Section: Manage Existing Cards

This section contains:

- Filter selector: `All decks` or one specific deck
- Card list

Each card entry shows:

- Deck badge
- Difficulty
- Front text
- Back text
- Repetitions count
- Last reviewed date
- Due relative time
- Edit button
- Delete button

## Progress Page

The Progress page contains progress and maintenance tools.

### Section: Reset Study Progress

This section resets review progress for all cards without deleting the card content.

Reset fields:

- `difficulty` becomes `3`
- `repetitions` becomes `0`
- `lastReviewed` becomes `null`
- `dueAt` becomes `now`

### Section: Study Statistics

This section shows:

- Total decks
- Total cards
- Due now
- Learned cards
- Reviewed today

## How "Due" Works

A card is counted as `Due` when its `dueAt` timestamp is less than or equal to the current time.

In practical terms:

- New cards are due immediately
- Reset cards are due immediately
- Reviewed cards become due again when their next scheduled time arrives

`Due` is used in multiple places:

- Header top stats
- Progress page statistics
- Deck summaries in Library
- Study queue generation

### Due Queue Algorithm

When building a study session:

1. The app filters cards by the selected deck, or uses all cards.
2. It collects cards where `dueAt <= now`.
3. Due cards are sorted by:
   - earliest `dueAt` first
   - then lower `difficulty` first
4. Up to 20 cards are placed in the session queue.

If no cards are currently due:

1. The app falls back to upcoming cards from the selected scope.
2. Fallback cards are sorted by:
   - lower `difficulty` first
   - then earlier `dueAt` first
3. Up to 20 cards are placed in the queue.

This fallback lets the user keep studying even when nothing is technically due.

## How "Learned" Works

A card is counted as `Learned` when:

- `repetitions >= 5`

This threshold is used in:

- Header top stats
- Progress page statistics
- Deck summaries
- Study session summary

`Learned` does not mean the card is removed from review. It only means the card has reached the learned threshold.

## Review Scheduling Algorithm

Each card stores:

- `difficulty`
- `repetitions`
- `lastReviewed`
- `dueAt`

Default values for a new card:

- `difficulty = 3`
- `repetitions = 0`
- `lastReviewed = null`
- `dueAt = now`

### Easy

When the user marks a card as `Easy`:

- `difficulty` increases by `0.5`, capped at `5`
- `repetitions` increases by `1`
- `lastReviewed` becomes `now`
- `dueAt` becomes `now + interval`

The interval is:

- `max(6, round(12 * 2^repetitions * (difficulty / 3)))` hours

This means easier cards move further into the future.

### Hard

When the user marks a card as `Hard`:

- `difficulty` decreases by `1`, floored at `1`
- `repetitions` stays the same
- `lastReviewed` becomes `now`
- `dueAt` becomes `now + interval`

The interval is:

- `max(5, 25 - repetitions * 2 - difficulty * 2)` minutes

This means hard cards return much sooner.

Inside the current study session, a `Hard` card is also reinserted near the front of the queue so it can reappear again soon during the same session.

## Data Storage

All persistent data stays in the browser.

Stored object types:

- Deck
  - `id`
  - `name`
  - `createdAt`
  - `updatedAt`
- Card
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

## Backup Notes

- Export creates a JSON snapshot of all decks and cards
- Import expects JSON with `decks` and `cards` arrays
- Import does not erase existing local data
- Import merges decks by name and adds cards into the local database

## Offline Notes

The app is designed to work offline after the app shell has been cached by the service worker.
