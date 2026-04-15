import './styles.css';
import {
  ensureDefaultDeck,
  exportData,
  getStatistics,
  importData,
  resetProgress
} from './db.js';
import { createCardsModule } from './modules/cards.js';
import { createStudyModule } from './modules/study.js';
import { createNotifier, downloadJson } from './modules/ui.js';

const VALID_MODES = new Set(['main', 'library', 'cards']);

const state = {
  activeMode: getRouteMode(),
  selectedDeckId: 'all'
};

await ensureDefaultDeck();

document.querySelector('#app').innerHTML = `
  <div class="app-shell">
    <header class="hero">
      <div>
        <p class="eyebrow">Local-first study system</p>
        <h1>Local Flashcards</h1>
        <p class="hero-copy">
          Build decks, review cards with spaced repetition, and keep everything in your browser.
        </p>
      </div>
      <nav class="mode-switcher" aria-label="Main navigation">
        <a class="nav-pill" href="#/main" data-mode="main">Main</a>
        <a class="nav-pill" href="#/library" data-mode="library">Library</a>
        <a class="nav-pill" href="#/cards" data-mode="cards">Cards</a>
      </nav>
      <div class="top-stats" data-role="top-stats"></div>
    </header>

    <main>
      <section class="mode-grid mode-grid-main-tools" data-mode-panel="main">
        <section class="panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Maintenance</p>
              <h2>Reset study progress</h2>
            </div>
          </div>
          <p class="panel-copy">
            This keeps your decks and card text intact but clears repetitions, review dates, and scheduling.
          </p>
          <button class="btn btn-danger" type="button" data-role="reset-progress">Reset progress</button>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Overview</p>
              <h2>Study statistics</h2>
            </div>
          </div>
          <div class="stats-grid" data-role="data-stats"></div>
        </section>
      </section>
      <section class="mode-stack" data-mode-panel="library" hidden>
        <section class="panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Backups</p>
              <h2>Import or export your decks</h2>
            </div>
          </div>
          <p class="panel-copy">
            Export creates a JSON snapshot of every deck and card. Import merges decks by name and appends cards locally.
          </p>
          <div class="actions-row">
            <button class="btn btn-primary" type="button" data-role="export-data">Export JSON</button>
            <label class="btn btn-muted upload-button">
              <input type="file" accept="application/json" data-role="import-file" hidden />
              Import JSON
            </label>
          </div>
        </section>
        <section class="mode-grid mode-grid-library" data-role="library-cards"></section>
      </section>
      <section class="mode-grid" data-mode-panel="cards" hidden></section>
    </main>

    <div class="toast-stack" data-role="toast-stack" aria-live="polite"></div>
  </div>
`;

const mainRoot = document.querySelector('[data-mode-panel="main"]');
const libraryPageRoot = document.querySelector('[data-mode-panel="library"]');
const libraryRoot = document.querySelector('[data-role="library-cards"]');
const studyRoot = document.querySelector('[data-mode-panel="cards"]');
const topStats = document.querySelector('[data-role="top-stats"]');
const dataStats = document.querySelector('[data-role="data-stats"]');
const toastStack = document.querySelector('[data-role="toast-stack"]');
const notify = createNotifier(toastStack);

const cardsModule = createCardsModule({
  root: libraryRoot,
  getSelectedDeckId: () => state.selectedDeckId,
  setSelectedDeckId: (deckId) => {
    state.selectedDeckId = String(deckId);
  },
  notify,
  navigate,
  onDataChange: handleDataChange
});

const studyModule = createStudyModule({
  root: studyRoot,
  getSelectedDeckId: () => state.selectedDeckId,
  setSelectedDeckId: (deckId) => {
    state.selectedDeckId = String(deckId);
  },
  isActive: () => state.activeMode === 'cards',
  notify,
  onDataChange: handleDataChange
});

window.addEventListener('hashchange', handleRouteChange);

libraryPageRoot.querySelector('[data-role="export-data"]').addEventListener('click', async () => {
  const payload = await exportData();
  const stamp = new Date().toISOString().slice(0, 10);

  downloadJson(`local-flashcards-${stamp}.json`, payload);
  notify('Data exported.');
});

libraryPageRoot.querySelector('[data-role="import-file"]').addEventListener('change', async (event) => {
  const [file] = event.target.files ?? [];

  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    await importData(text);
    event.target.value = '';
    notify('Import completed.');
    await refreshApp({ refreshCards: true, refreshStudy: true });
  } catch (error) {
    notify(error.message, 'error');
  }
});

mainRoot.querySelector('[data-role="reset-progress"]').addEventListener('click', async () => {
  const confirmed = window.confirm('Reset spaced repetition progress for all cards?');

  if (!confirmed) {
    return;
  }

  await resetProgress({ deckId: 'all' });
  notify('Study progress reset.');
  await refreshApp({ refreshCards: true, refreshStudy: true });
});

function syncVisibleMode() {
  document.querySelectorAll('[data-mode]').forEach((button) => {
    button.classList.toggle('nav-pill-active', button.dataset.mode === state.activeMode);
  });

  document.querySelectorAll('[data-mode-panel]').forEach((panel) => {
    const isActivePanel = panel.dataset.modePanel === state.activeMode;
    panel.hidden = !isActivePanel;
    panel.style.display = isActivePanel ? '' : 'none';
  });
}

function getRouteMode() {
  const route = window.location.hash.replace(/^#\/?/, '');
  return VALID_MODES.has(route) ? route : 'main';
}

function navigate(mode) {
  const nextHash = `#/${mode}`;

  if (window.location.hash === nextHash) {
    state.activeMode = mode;
    syncVisibleMode();
    return;
  }

  window.location.hash = nextHash;
}

async function handleRouteChange() {
  state.activeMode = getRouteMode();
  syncVisibleMode();

  if (state.activeMode === 'cards') {
    await studyModule.reload();
    await studyModule.render();
  }
}

async function renderStatistics() {
  const stats = await getStatistics();
  const tiles = [
    ['Decks', stats.deckCount],
    ['Cards', stats.cardCount],
    ['Due', stats.dueCount],
    ['Learned', stats.learnedCount]
  ];

  topStats.innerHTML = tiles
    .map(
      ([label, value]) => `
        <article class="top-stat">
          <strong>${value}</strong>
          <span>${label}</span>
        </article>
      `
    )
    .join('');

  dataStats.innerHTML = [
    ['Total decks', stats.deckCount],
    ['Total cards', stats.cardCount],
    ['Due now', stats.dueCount],
    ['Learned cards', stats.learnedCount],
    ['Reviewed today', stats.reviewedToday]
  ]
    .map(
      ([label, value]) => `
        <article class="stat-card">
          <strong>${value}</strong>
          <span>${label}</span>
        </article>
      `
    )
    .join('');
}

async function handleDataChange({
  refreshCards = false,
  refreshStudy = false
} = {}) {
  await renderStatistics();

  if (refreshCards) {
    await cardsModule.render();
  }

  if (refreshStudy) {
    await studyModule.reload();
    await studyModule.render();
  }
}

async function refreshApp({
  refreshCards = true,
  refreshStudy = true
} = {}) {
  await renderStatistics();

  if (refreshCards) {
    await cardsModule.render();
  }

  if (refreshStudy) {
    await studyModule.reload();
    await studyModule.render();
  }
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  if (!import.meta.env.PROD) {
    const registrations = await navigator.serviceWorker.getRegistrations();

    await Promise.all(registrations.map((registration) => registration.unregister()));

    if ('caches' in window) {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter((key) => key.startsWith('local-flashcards-'))
          .map((key) => caches.delete(key))
      );
    }

    return;
  }

  try {
    await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`);
  } catch (error) {
    console.error('Service worker registration failed:', error);
  }
}

if (!window.location.hash || !VALID_MODES.has(window.location.hash.replace(/^#\/?/, ''))) {
  window.location.hash = '#/main';
}

syncVisibleMode();
await refreshApp();
await handleRouteChange();
await registerServiceWorker();
