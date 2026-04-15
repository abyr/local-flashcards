# Local Flashcards

Local Flashcards is a static Vite app for creating and studying flashcards entirely in the browser. It stores decks and cards in IndexedDB through Dexie, supports spaced repetition, works offline after caching, and can be deployed to GitHub Pages.

## Features

- Create, edit, and delete flashcards
- Group flashcards into decks
- Study cards one at a time with flip, Easy, and Hard actions
- Track repetitions, last reviewed date, and difficulty score
- Reintroduce hard cards more often during a session
- Export and import JSON backups
- Reset study progress without deleting card content
- Keyboard shortcuts in study mode
- Offline-ready after the app shell is cached

## Scripts

```bash
npm install
npm run dev
```

Additional scripts:

```bash
npm run build
npm run preview
npm run deploy
```

## Keyboard Shortcuts

- `Space`: flip the current card
- `ArrowLeft`: mark as Hard
- `ArrowRight`: mark as Easy

## Project Structure

```text
local-flashcards/
├── db.js
├── index.html
├── initial-prompt.md
├── main.js
├── modules/
│   ├── cards.js
│   ├── study.js
│   └── ui.js
├── package.json
├── public/
│   └── sw.js
├── README.md
├── styles.css
└── vite.config.js
```

## GitHub Pages Deployment

The included Vite config uses `/local-flashcards/` as the production base path. If your repository name changes, update `base` in [vite.config.js](/home/odenysen/Workspace/local-flashcards/vite.config.js).

Typical deployment flow:

1. Push this project to a GitHub repository named `local-flashcards`.
2. Run `npm install`.
3. Run `npm run deploy`.
4. In GitHub, open repository settings and confirm GitHub Pages is configured to serve from the `gh-pages` branch.

If you prefer GitHub Actions instead of the `gh-pages` CLI, build the `dist/` folder and publish it as the Pages artifact.
