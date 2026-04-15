import Dexie from 'dexie';

const DEFAULT_DECK_NAME = 'Starter Deck';
const LEARNED_REPETITIONS = 5;
const DEFAULT_DIFFICULTY = 3;

export const db = new Dexie('local-flashcards');

db.version(1).stores({
  decks: '++id, name, createdAt, updatedAt',
  cards:
    '++id, deckId, front, back, dueAt, difficulty, lastReviewed, repetitions, createdAt, updatedAt'
});

function clampDifficulty(value) {
  return Math.max(1, Math.min(5, Number(value) || DEFAULT_DIFFICULTY));
}

function sanitizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

function toTimestamp(value) {
  if (!value) {
    return null;
  }

  const timestamp = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function buildIntervals(repetitions, difficulty) {
  const difficultyFactor = difficulty / DEFAULT_DIFFICULTY;
  const hours = Math.max(6, Math.round(12 * 2 ** repetitions * difficultyFactor));
  return hours * 60 * 60 * 1000;
}

function buildHardInterval(repetitions, difficulty) {
  const baseMinutes = Math.max(5, 25 - repetitions * 2 - difficulty * 2);
  return baseMinutes * 60 * 1000;
}

function normalizeCardPayload(card) {
  const front = sanitizeText(card.front);
  const back = sanitizeText(card.back);
  const deckId = Number(card.deckId);

  if (!front || !back) {
    throw new Error('Front and back are required.');
  }

  if (!Number.isInteger(deckId) || deckId <= 0) {
    throw new Error('A valid deck is required.');
  }

  return {
    deckId,
    front,
    back
  };
}

export async function ensureDefaultDeck() {
  const totalDecks = await db.decks.count();

  if (totalDecks > 0) {
    return;
  }

  const now = Date.now();

  await db.decks.add({
    name: DEFAULT_DECK_NAME,
    createdAt: now,
    updatedAt: now
  });
}

export async function listDecks() {
  return db.decks.orderBy('name').toArray();
}

export async function getDeckSummaries() {
  const [decks, cards] = await Promise.all([listDecks(), db.cards.toArray()]);
  const now = Date.now();

  return decks.map((deck) => {
    const deckCards = cards.filter((card) => card.deckId === deck.id);
    const dueCount = deckCards.filter((card) => (card.dueAt ?? 0) <= now).length;

    return {
      ...deck,
      cardCount: deckCards.length,
      dueCount,
      learnedCount: deckCards.filter((card) => (card.repetitions ?? 0) >= LEARNED_REPETITIONS).length
    };
  });
}

export async function saveDeck({ id, name }) {
  const cleanedName = sanitizeText(name);

  if (!cleanedName) {
    throw new Error('Deck name cannot be empty.');
  }

  const now = Date.now();

  if (!id) {
    const duplicate = await db.decks.where('name').equalsIgnoreCase(cleanedName).first();

    if (duplicate) {
      throw new Error('A deck with this name already exists.');
    }

    return db.decks.add({
      name: cleanedName,
      createdAt: now,
      updatedAt: now
    });
  }

  const existing = await db.decks.get(Number(id));

  if (!existing) {
    throw new Error('Deck not found.');
  }

  await db.decks.update(existing.id, {
    name: cleanedName,
    updatedAt: now
  });

  return existing.id;
}

export async function deleteDeck(deckId) {
  const numericId = Number(deckId);
  const totalDecks = await db.decks.count();

  if (totalDecks <= 1) {
    throw new Error('At least one deck must remain.');
  }

  await db.transaction('rw', db.decks, db.cards, async () => {
    await db.cards.where('deckId').equals(numericId).delete();
    await db.decks.delete(numericId);
  });
}

export async function listCards(deckId = null) {
  const cards = deckId ? await db.cards.where('deckId').equals(Number(deckId)).sortBy('front') : await db.cards.orderBy('front').toArray();
  const decks = await listDecks();
  const deckMap = new Map(decks.map((deck) => [deck.id, deck.name]));

  return cards.map((card) => ({
    ...card,
    deckName: deckMap.get(card.deckId) ?? 'Unknown deck'
  }));
}

export async function saveCard(card) {
  const payload = normalizeCardPayload(card);
  const now = Date.now();

  if (!card.id) {
    return db.cards.add({
      ...payload,
      difficulty: DEFAULT_DIFFICULTY,
      repetitions: 0,
      lastReviewed: null,
      dueAt: now,
      createdAt: now,
      updatedAt: now
    });
  }

  const existing = await db.cards.get(Number(card.id));

  if (!existing) {
    throw new Error('Card not found.');
  }

  await db.cards.update(existing.id, {
    ...payload,
    updatedAt: now
  });

  return existing.id;
}

export async function deleteCard(cardId) {
  return db.cards.delete(Number(cardId));
}

export async function getCard(cardId) {
  return db.cards.get(Number(cardId));
}

export async function getStudyCards({ deckId = 'all', limit = 20 } = {}) {
  const allCards = await db.cards.toArray();
  const now = Date.now();
  const scopedCards =
    deckId === 'all'
      ? allCards
      : allCards.filter((card) => card.deckId === Number(deckId));

  const dueCards = scopedCards
    .filter((card) => (card.dueAt ?? 0) <= now)
    .sort((left, right) => {
      const dueDelta = (left.dueAt ?? 0) - (right.dueAt ?? 0);

      if (dueDelta !== 0) {
        return dueDelta;
      }

      return (left.difficulty ?? DEFAULT_DIFFICULTY) - (right.difficulty ?? DEFAULT_DIFFICULTY);
    });

  if (dueCards.length > 0) {
    return {
      cards: dueCards.slice(0, limit),
      dueCount: dueCards.length,
      totalCount: scopedCards.length,
      usedFallback: false
    };
  }

  const fallbackCards = scopedCards
    .slice()
    .sort((left, right) => {
      const difficultyDelta = (left.difficulty ?? DEFAULT_DIFFICULTY) - (right.difficulty ?? DEFAULT_DIFFICULTY);

      if (difficultyDelta !== 0) {
        return difficultyDelta;
      }

      return (left.dueAt ?? now) - (right.dueAt ?? now);
    });

  return {
    cards: fallbackCards.slice(0, limit),
    dueCount: 0,
    totalCount: scopedCards.length,
    usedFallback: fallbackCards.length > 0
  };
}

export async function reviewCard(cardId, verdict) {
  const card = await getCard(cardId);

  if (!card) {
    throw new Error('Card not found.');
  }

  const now = Date.now();
  const currentDifficulty = clampDifficulty(card.difficulty);
  const currentRepetitions = Number(card.repetitions) || 0;

  let nextDifficulty = currentDifficulty;
  let nextRepetitions = currentRepetitions;
  let interval = 0;

  if (verdict === 'easy') {
    nextDifficulty = clampDifficulty(currentDifficulty + 0.5);
    nextRepetitions = currentRepetitions + 1;
    interval = buildIntervals(nextRepetitions, nextDifficulty);
  } else if (verdict === 'hard') {
    nextDifficulty = clampDifficulty(currentDifficulty - 1);
    nextRepetitions = Math.max(0, currentRepetitions);
    interval = buildHardInterval(nextRepetitions, nextDifficulty);
  } else {
    throw new Error('Unsupported review verdict.');
  }

  const updates = {
    difficulty: nextDifficulty,
    repetitions: nextRepetitions,
    lastReviewed: now,
    dueAt: now + interval,
    updatedAt: now
  };

  await db.cards.update(card.id, updates);

  return {
    ...card,
    ...updates
  };
}

export async function resetProgress({ deckId = 'all' } = {}) {
  const now = Date.now();
  const collection = deckId === 'all' ? db.cards.toCollection() : db.cards.where('deckId').equals(Number(deckId));

  await collection.modify({
    difficulty: DEFAULT_DIFFICULTY,
    repetitions: 0,
    lastReviewed: null,
    dueAt: now,
    updatedAt: now
  });
}

export async function getStatistics() {
  const cards = await db.cards.toArray();
  const decks = await db.decks.count();
  const now = Date.now();
  const todayStart = new Date();

  todayStart.setHours(0, 0, 0, 0);

  return {
    deckCount: decks,
    cardCount: cards.length,
    dueCount: cards.filter((card) => (card.dueAt ?? 0) <= now).length,
    learnedCount: cards.filter((card) => (card.repetitions ?? 0) >= LEARNED_REPETITIONS).length,
    reviewedToday: cards.filter((card) => (card.lastReviewed ?? 0) >= todayStart.getTime()).length
  };
}

export async function exportData() {
  const [decks, cards] = await Promise.all([db.decks.toArray(), db.cards.toArray()]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    decks,
    cards
  };
}

export async function importData(rawText) {
  let payload;

  try {
    payload = JSON.parse(rawText);
  } catch (error) {
    throw new Error('Import file is not valid JSON.');
  }

  if (!Array.isArray(payload?.decks) || !Array.isArray(payload?.cards)) {
    throw new Error('Import file must include decks and cards arrays.');
  }

  const now = Date.now();

  await db.transaction('rw', db.decks, db.cards, async () => {
    const deckIdMap = new Map();

    for (const deck of payload.decks) {
      const name = sanitizeText(deck?.name);

      if (!name) {
        continue;
      }

      const existing = await db.decks.where('name').equalsIgnoreCase(name).first();

      if (existing) {
        deckIdMap.set(deck.id, existing.id);
        continue;
      }

      const nextId = await db.decks.add({
        name,
        createdAt: toTimestamp(deck.createdAt) ?? now,
        updatedAt: now
      });

      deckIdMap.set(deck.id, nextId);
    }

    for (const card of payload.cards) {
      const mappedDeckId = deckIdMap.get(card?.deckId);

      if (!mappedDeckId) {
        continue;
      }

      const front = sanitizeText(card?.front);
      const back = sanitizeText(card?.back);

      if (!front || !back || front === back) {
        continue;
      }

      await db.cards.add({
        deckId: mappedDeckId,
        front,
        back,
        difficulty: clampDifficulty(card?.difficulty),
        lastReviewed: toTimestamp(card?.lastReviewed),
        repetitions: Math.max(0, Number(card?.repetitions) || 0),
        dueAt: toTimestamp(card?.dueAt) ?? now,
        createdAt: toTimestamp(card?.createdAt) ?? now,
        updatedAt: now
      });
    }
  });

  await ensureDefaultDeck();
}
