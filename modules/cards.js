import {
  deleteCard,
  deleteDeck,
  getCard,
  getDeckSummaries,
  listCards,
  saveCard,
  saveDeck
} from '../db.js';
import { escapeHtml, formatDate, formatRelativeTime } from './ui.js';

export function createCardsModule({
  root,
  getSelectedDeckId,
  setSelectedDeckId,
  notify,
  navigate,
  onDataChange
}) {
  let editingCardId = null;
  let deckSummaries = [];

  root.innerHTML = `
    <section class="panel panel-decks">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Decks</p>
          <h2>Organize your decks</h2>
        </div>
      </div>
      <form class="stack-sm" data-role="deck-form">
        <label class="field">
          <span>New deck name</span>
          <input name="name" type="text" maxlength="60" placeholder="Spanish Basics" required />
        </label>
        <button class="btn btn-primary" type="submit">Add deck</button>
      </form>
      <div class="deck-list" data-role="deck-list"></div>
    </section>

    <section class="panel panel-editor">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Cards</p>
          <h2 data-role="editor-title">Create a new card</h2>
        </div>
      </div>
      <form class="stack-md" data-role="card-form">
        <label class="field">
          <span>Deck</span>
          <select name="deckId" data-role="deck-select" required></select>
        </label>
        <label class="field">
          <span>Front</span>
          <input name="front" type="text" maxlength="140" placeholder="Bonjour" required />
        </label>
        <label class="field">
          <span>Back</span>
          <textarea name="back" rows="4" maxlength="500" placeholder="Hello" required></textarea>
        </label>
        <div class="actions-row">
          <button class="btn btn-primary" type="submit" data-role="save-card">Save card</button>
          <button class="btn btn-muted" type="button" data-role="cancel-edit" hidden>Cancel edit</button>
        </div>
      </form>
    </section>

    <section class="panel panel-list">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Library</p>
          <h2>Manage existing cards</h2>
        </div>
        <label class="field inline-field">
          <span>Filter</span>
          <select data-role="filter-select"></select>
        </label>
      </div>
      <div class="card-list" data-role="card-list"></div>
    </section>
  `;

  const deckForm = root.querySelector('[data-role="deck-form"]');
  const deckList = root.querySelector('[data-role="deck-list"]');
  const cardForm = root.querySelector('[data-role="card-form"]');
  const deckSelect = root.querySelector('[data-role="deck-select"]');
  const editorTitle = root.querySelector('[data-role="editor-title"]');
  const cancelEditButton = root.querySelector('[data-role="cancel-edit"]');
  const filterSelect = root.querySelector('[data-role="filter-select"]');
  const cardList = root.querySelector('[data-role="card-list"]');

  deckForm.addEventListener('submit', handleDeckSubmit);
  cardForm.addEventListener('submit', handleCardSubmit);
  cancelEditButton.addEventListener('click', resetEditor);
  filterSelect.addEventListener('change', async (event) => {
    setSelectedDeckId(event.target.value);
    await render();
    onDataChange({ refreshStudy: true });
  });
  root.addEventListener('click', handleClicks);

  async function handleDeckSubmit(event) {
    event.preventDefault();
    const form = new FormData(deckForm);

    try {
      const deckId = await saveDeck({ name: form.get('name') });

      deckForm.reset();
      setSelectedDeckId(String(deckId));
      notify('Deck created.');
      await render();
      onDataChange({ refreshStudy: true });
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  async function handleCardSubmit(event) {
    event.preventDefault();
    const form = new FormData(cardForm);
    const payload = {
      id: editingCardId,
      deckId: form.get('deckId'),
      front: form.get('front'),
      back: form.get('back')
    };

    try {
      await saveCard(payload);
      notify(editingCardId ? 'Card updated.' : 'Card created.');
      resetEditor();
      await render();
      onDataChange({ refreshStudy: true });
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  async function handleClicks(event) {
    const actionTarget = event.target.closest('[data-action]');

    if (!actionTarget) {
      return;
    }

    const { action, id } = actionTarget.dataset;

    try {
      if (action === 'select-deck') {
        setSelectedDeckId(id);
        await render();
        onDataChange({ refreshStudy: true });
        return;
      }

      if (action === 'rename-deck') {
        const currentDeck = deckSummaries.find((deck) => String(deck.id) === String(id));
        const nextName = window.prompt('Rename deck', currentDeck?.name ?? '');

        if (!nextName) {
          return;
        }

        await saveDeck({ id, name: nextName });
        notify('Deck renamed.');
        await render();
        onDataChange({ refreshStudy: true });
        return;
      }

      if (action === 'delete-deck') {
        const confirmed = window.confirm('Delete this deck and all cards inside it?');

        if (!confirmed) {
          return;
        }

        await deleteDeck(id);
        setSelectedDeckId('all');
        notify('Deck deleted.');
        resetEditor();
        await render();
        onDataChange({ refreshStudy: true });
        return;
      }

      if (action === 'edit-card') {
        const card = await getCard(id);

        if (!card) {
          notify('Card no longer exists.', 'error');
          return;
        }

        await startEditingCard(card);
        return;
      }

      if (action === 'delete-card') {
        const confirmed = window.confirm('Delete this card?');

        if (!confirmed) {
          return;
        }

        await deleteCard(id);

        if (Number(id) === editingCardId) {
          resetEditor();
        }

        notify('Card deleted.');
        await render();
        onDataChange({ refreshStudy: true });
      }
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  function resetEditor() {
    editingCardId = null;
    editorTitle.textContent = 'Create a new card';
    cardForm.reset();
    cancelEditButton.hidden = true;

    const selectedDeckId = getSelectedDeckId();

    if (selectedDeckId !== 'all' && deckSelect.querySelector(`option[value="${selectedDeckId}"]`)) {
      deckSelect.value = selectedDeckId;
    }
  }

  async function startEditingCard(card) {
    setSelectedDeckId(String(card.deckId));
    navigate('library');
    await render();

    editingCardId = card.id;
    editorTitle.textContent = `Editing "${card.front}"`;
    cancelEditButton.hidden = false;
    deckSelect.value = String(card.deckId);
    cardForm.elements.front.value = card.front;
    cardForm.elements.back.value = card.back;
    root.scrollIntoView({ block: 'start', behavior: 'smooth' });
    cardForm.elements.front.focus();
  }

  function renderDeckOptions(decks) {
    deckSelect.innerHTML = decks
      .map((deck) => `<option value="${deck.id}">${escapeHtml(deck.name)}</option>`)
      .join('');

    filterSelect.innerHTML = [
      '<option value="all">All decks</option>',
      ...decks.map((deck) => `<option value="${deck.id}">${escapeHtml(deck.name)}</option>`)
    ].join('');

    const selectedDeckId = getSelectedDeckId();
    const fallbackDeckId = decks[0] ? String(decks[0].id) : 'all';

    filterSelect.value =
      decks.some((deck) => String(deck.id) === selectedDeckId) || selectedDeckId === 'all' ? selectedDeckId : 'all';
    deckSelect.value =
      selectedDeckId !== 'all' && decks.some((deck) => String(deck.id) === selectedDeckId) ? selectedDeckId : fallbackDeckId;
  }

  function renderDeckList(decks) {
    const selectedDeckId = getSelectedDeckId();

    deckList.innerHTML = decks
      .map((deck) => {
        const selected = String(deck.id) === selectedDeckId;

        return `
          <article class="deck-card ${selected ? 'deck-card-active' : ''}">
            <button class="deck-card-main" type="button" data-action="select-deck" data-id="${deck.id}">
              <strong>${escapeHtml(deck.name)}</strong>
              <span>${deck.cardCount} cards</span>
              <span>${deck.dueCount} due</span>
            </button>
            <div class="deck-card-actions">
              <button class="icon-button" type="button" data-action="rename-deck" data-id="${deck.id}">Rename</button>
              <button class="icon-button danger-text" type="button" data-action="delete-deck" data-id="${deck.id}">Delete</button>
            </div>
          </article>
        `;
      })
      .join('');
  }

  function renderCardList(cards) {
    if (cards.length === 0) {
      cardList.innerHTML = `
        <div class="empty-state">
          <h3>No cards yet</h3>
          <p>Create a card to start studying locally.</p>
        </div>
      `;
      return;
    }

    cardList.innerHTML = cards
      .map(
        (card) => `
          <article class="library-card">
            <div class="library-card-copy">
              <div class="library-card-meta">
                <span class="badge">${escapeHtml(card.deckName)}</span>
                <span class="muted">Difficulty ${card.difficulty ?? 3}/5</span>
              </div>
              <h3>${escapeHtml(card.front)}</h3>
              <p>${escapeHtml(card.back)}</p>
            </div>
            <div class="library-card-footer">
              <div class="library-card-stats">
                <span>Repetitions: ${card.repetitions ?? 0}</span>
                <span>Last reviewed: ${formatDate(card.lastReviewed)}</span>
                <span>Due: ${formatRelativeTime(card.dueAt)}</span>
              </div>
              <div class="actions-row">
                <button class="btn btn-muted" type="button" data-action="edit-card" data-id="${card.id}">Edit</button>
                <button class="btn btn-danger" type="button" data-action="delete-card" data-id="${card.id}">Delete</button>
              </div>
            </div>
          </article>
        `
      )
      .join('');
  }

  async function render() {
    const decks = await getDeckSummaries();
    deckSummaries = decks;

    if (decks.length === 0) {
      deckList.innerHTML = '';
      deckSelect.innerHTML = '';
      filterSelect.innerHTML = '<option value="all">All decks</option>';
      renderCardList([]);
      return;
    }

    const selectedDeckId = getSelectedDeckId();

    if (selectedDeckId !== 'all' && !decks.some((deck) => String(deck.id) === selectedDeckId)) {
      setSelectedDeckId('all');
    }

    renderDeckOptions(decks);
    renderDeckList(decks);

    const cards = await listCards(getSelectedDeckId() === 'all' ? null : getSelectedDeckId());
    renderCardList(cards);

    if (!editingCardId) {
      resetEditor();
    }
  }

  return {
    render,
    resetEditor
  };
}
