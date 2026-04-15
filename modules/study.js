import { getDeckSummaries, getStatistics, getStudyCards, reviewCard } from '../db.js';
import { escapeHtml, formatRelativeTime, isInteractiveTarget } from './ui.js';

export function createStudyModule({
  root,
  getSelectedDeckId,
  setSelectedDeckId,
  isActive,
  notify,
  onDataChange
}) {
  let sessionDeckId = null;
  let queue = [];
  let currentCard = null;
  let flipped = false;
  let usedFallback = false;

  root.innerHTML = `
    <section class="panel panel-study-controls">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Cards</p>
          <h2>Review one card at a time</h2>
        </div>
      </div>
      <div class="stack-sm">
        <label class="field">
          <span>Deck</span>
          <select data-role="study-deck"></select>
        </label>
        <div class="study-summary" data-role="study-summary"></div>
        <button class="btn btn-muted" type="button" data-role="reload-session">Refresh queue</button>
      </div>
    </section>

    <section class="panel panel-study-card">
      <div class="flashcard-shell" data-role="flashcard-shell">
        <div class="flashcard-face">
          <p class="flashcard-label" data-role="flashcard-label">Front</p>
          <h3 data-role="flashcard-front">Pick a deck to begin.</h3>
          <p class="flashcard-back" data-role="flashcard-back"></p>
        </div>
      </div>
      <p class="study-hint" data-role="study-hint">Space flips the card. Left arrow = Hard, right arrow = Easy.</p>
      <div class="actions-row">
        <button class="btn btn-primary" type="button" data-role="flip">Flip card</button>
        <button class="btn btn-danger" type="button" data-role="mark-hard">Hard</button>
        <button class="btn btn-success" type="button" data-role="mark-easy">Easy</button>
      </div>
    </section>
  `;

  const deckSelect = root.querySelector('[data-role="study-deck"]');
  const summary = root.querySelector('[data-role="study-summary"]');
  const flashcardShell = root.querySelector('[data-role="flashcard-shell"]');
  const flashcardLabel = root.querySelector('[data-role="flashcard-label"]');
  const flashcardFront = root.querySelector('[data-role="flashcard-front"]');
  const flashcardBack = root.querySelector('[data-role="flashcard-back"]');
  const studyHint = root.querySelector('[data-role="study-hint"]');
  const flipButton = root.querySelector('[data-role="flip"]');
  const hardButton = root.querySelector('[data-role="mark-hard"]');
  const easyButton = root.querySelector('[data-role="mark-easy"]');
  const reloadButton = root.querySelector('[data-role="reload-session"]');

  deckSelect.addEventListener('change', async (event) => {
    setSelectedDeckId(event.target.value);
    await loadSession(true);
    await render();
    onDataChange({ refreshCards: true, refreshStudy: false });
  });

  flipButton.addEventListener('click', () => flipCard());
  hardButton.addEventListener('click', () => markCard('hard'));
  easyButton.addEventListener('click', () => markCard('easy'));
  reloadButton.addEventListener('click', async () => {
    await loadSession(true);
    await render();
  });

  document.addEventListener('keydown', async (event) => {
    if (!isActive() || isInteractiveTarget(event.target)) {
      return;
    }

    if (event.code === 'Space') {
      event.preventDefault();
      flipCard();
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      await markCard('hard');
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      await markCard('easy');
    }
  });

  async function renderDeckOptions() {
    const decks = await getDeckSummaries();
    const selectedDeckId = getSelectedDeckId();

    deckSelect.innerHTML = [
      '<option value="all">All decks</option>',
      ...decks.map((deck) => `<option value="${deck.id}">${escapeHtml(deck.name)} (${deck.dueCount} due)</option>`)
    ].join('');

    deckSelect.value =
      selectedDeckId === 'all' || decks.some((deck) => String(deck.id) === selectedDeckId) ? selectedDeckId : 'all';
  }

  function syncCardView() {
    const hasCard = Boolean(currentCard);

    flashcardShell.classList.toggle('flashcard-shell-flipped', flipped && hasCard);
    hardButton.disabled = !hasCard || !flipped;
    easyButton.disabled = !hasCard || !flipped;
    flipButton.disabled = !hasCard;

    if (!hasCard) {
      flashcardLabel.textContent = 'Ready';
      flashcardFront.textContent = usedFallback
        ? 'No cards are currently due.'
        : 'No cards available yet.';
      flashcardBack.textContent = usedFallback
        ? 'You can still review the toughest upcoming cards or add new material.'
        : 'Create cards in Add Cards mode to start a study session.';
      studyHint.textContent = 'Space flips the card. Left arrow = Hard, right arrow = Easy.';
      return;
    }

    flashcardLabel.textContent = flipped ? 'Back' : 'Front';
    flashcardFront.textContent = currentCard.front;
    flashcardBack.textContent = flipped ? currentCard.back : 'Flip to reveal the answer.';
    studyHint.textContent = flipped
      ? 'Choose a difficulty to schedule the next review.'
      : 'Press Space or use the Flip button to reveal the answer.';
  }

  async function renderSummary() {
    const stats = await getStatistics();

    summary.innerHTML = `
      <div class="stat-tile">
        <strong>${queue.length + (currentCard ? 1 : 0)}</strong>
        <span>Cards in queue</span>
      </div>
      <div class="stat-tile">
        <strong>${stats.dueCount}</strong>
        <span>Due now</span>
      </div>
      <div class="stat-tile">
        <strong>${stats.learnedCount}</strong>
        <span>Learned</span>
      </div>
      <div class="stat-tile">
        <strong>${stats.reviewedToday}</strong>
        <span>Reviewed today</span>
      </div>
    `;
  }

  function flipCard() {
    if (!currentCard) {
      return;
    }

    flipped = !flipped;
    syncCardView();
  }

  async function loadSession(force = false) {
    const selectedDeckId = getSelectedDeckId();

    if (!force && sessionDeckId === selectedDeckId && (currentCard || queue.length > 0)) {
      return;
    }

    const session = await getStudyCards({ deckId: selectedDeckId, limit: 20 });

    sessionDeckId = selectedDeckId;
    usedFallback = session.usedFallback;
    queue = session.cards.slice();
    currentCard = queue.shift() ?? null;
    flipped = false;
  }

  async function markCard(verdict) {
    if (!currentCard) {
      return;
    }

    if (!flipped) {
      flipCard();
      return;
    }

    try {
      const reviewedCard = await reviewCard(currentCard.id, verdict);

      if (verdict === 'hard') {
        const insertIndex = Math.min(1, queue.length);
        queue.splice(insertIndex, 0, reviewedCard);
      }

      currentCard = queue.shift() ?? null;
      flipped = false;

      if (!currentCard && queue.length === 0) {
        await loadSession(true);
      }

      await render();
      onDataChange({ refreshCards: true, refreshStudy: false });
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  async function render() {
    await renderDeckOptions();
    await loadSession(false);
    await renderSummary();
    syncCardView();

    if (currentCard) {
      flashcardShell.dataset.due = formatRelativeTime(currentCard.dueAt);
    } else {
      delete flashcardShell.dataset.due;
    }
  }

  return {
    render,
    reload: () => loadSession(true)
  };
}
