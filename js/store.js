import { newSrs, startOfDay, isDue } from './srs.js';

const KEY = 'topik-cards-v1';

export const DEFAULT_SETTINGS = {
  newPerDay: 20,
  direction: 'ko2ja', // ko2ja | ja2ko | mix
  autoSpeak: false,
  ttsRate: 0.9,
  apiKey: '',
  model: 'claude-opus-5-5',
  extraRules: '',
  theme: 'auto',
};

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      s.settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
      s.stats = s.stats || { days: {} };
      return s;
    }
  } catch (e) {
    console.warn('load failed', e);
  }
  return { decks: [], cards: [], settings: { ...DEFAULT_SETTINGS }, stats: { days: {} }, seeded: false };
}

let saveTimer = null;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 150);
}
export function flush() {
  clearTimeout(saveTimer);
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    alert('保存できませんでした（容量不足の可能性）: ' + e.message);
  }
}
window.addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function getState() { return state; }
export function settings() { return state.settings; }
export function setSettings(patch) { Object.assign(state.settings, patch); save(); }

export function decks() { return state.decks; }
export function deck(id) { return state.decks.find((d) => d.id === id); }
export function cardsOf(deckId) { return state.cards.filter((c) => c.deckId === deckId); }
export function card(id) { return state.cards.find((c) => c.id === id); }

export function addDeck(name) {
  const d = { id: uid(), name: name.trim() || '新しい単語帳', created: Date.now() };
  state.decks.push(d);
  save();
  return d;
}
export function renameDeck(id, name) { const d = deck(id); if (d) { d.name = name; save(); } }
export function deleteDeck(id) {
  state.decks = state.decks.filter((d) => d.id !== id);
  state.cards = state.cards.filter((c) => c.deckId !== id);
  save();
}

export function normalizeCard(raw, deckId) {
  return {
    id: uid(),
    deckId,
    type: raw.type === 'grammar' ? 'grammar' : 'vocab',
    front: String(raw.front || '').trim(),
    back: String(raw.back || '').trim(),
    category: String(raw.category || '').trim(),
    note: String(raw.note || '').trim(),
    examples: (raw.examples || [])
      .filter((e) => e && e.ko)
      .map((e) => ({ ko: String(e.ko).trim(), ja: String(e.ja || '').trim(), target: String(e.target || '').trim(), advanced: !!e.advanced })),
    srs: newSrs(),
    created: Date.now(),
  };
}

export function addCards(deckId, raws) {
  const existing = new Set(cardsOf(deckId).map((c) => c.front + '\u0000' + c.back));
  let added = 0, skipped = 0;
  for (const r of raws) {
    const c = normalizeCard(r, deckId);
    if (!c.front || !c.back) { skipped++; continue; }
    const k = c.front + '\u0000' + c.back;
    if (existing.has(k)) { skipped++; continue; }
    existing.add(k);
    state.cards.push(c);
    added++;
  }
  save();
  return { added, skipped };
}

export function updateCard(id, patch) {
  const c = card(id);
  if (c) { Object.assign(c, patch); save(); }
}
export function deleteCard(id) {
  state.cards = state.cards.filter((c) => c.id !== id);
  save();
}
export function resetCard(id) { updateCard(id, { srs: newSrs() }); }

// ---- 統計・今日の数 ----
export function dayKey(t = Date.now()) {
  const d = new Date(startOfDay(t));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function today() {
  const k = dayKey();
  state.stats.days[k] = state.stats.days[k] || { reviews: 0, correct: 0, newByDeck: {}, quiz: 0, quizCorrect: 0 };
  return state.stats.days[k];
}
export function todayStats() { return today(); }

export function recordReview(cardObj, rating, wasNew) {
  const t = today();
  t.reviews++;
  if (rating >= 3) t.correct++;
  if (wasNew) t.newByDeck[cardObj.deckId] = (t.newByDeck[cardObj.deckId] || 0) + 1;
  save();
}
export function recordQuiz(correct) {
  const t = today();
  t.quiz++;
  if (correct) t.quizCorrect++;
  save();
}

export function newLeftToday(deckId) {
  const used = today().newByDeck[deckId] || 0;
  return Math.max(0, state.settings.newPerDay - used);
}

export function deckCounts(deckId, now = Date.now()) {
  const cs = cardsOf(deckId);
  let fresh = 0, learn = 0, review = 0;
  for (const c of cs) {
    if (c.srs.state === 'new') fresh++;
    else if (isDue(c, now)) (c.srs.state === 'review' ? review++ : learn++);
  }
  return { total: cs.length, fresh: Math.min(fresh, newLeftToday(deckId)), freshAll: fresh, learn, review };
}

export function streak() {
  let n = 0;
  let t = Date.now();
  // 今日まだ学習していなくても昨日まで続いていれば数える
  if (!(state.stats.days[dayKey(t)]?.reviews || state.stats.days[dayKey(t)]?.quiz)) t -= 86400000;
  for (;;) {
    const d = state.stats.days[dayKey(t)];
    if (d && (d.reviews || d.quiz)) { n++; t -= 86400000; } else break;
  }
  return n;
}

// ---- バックアップ ----
export function exportAll() { return JSON.stringify(state, null, 1); }
export function importAll(json) {
  const s = JSON.parse(json);
  if (!Array.isArray(s.decks) || !Array.isArray(s.cards)) throw new Error('形式が正しくありません');
  s.settings = { ...DEFAULT_SETTINGS, ...(s.settings || {}) };
  s.stats = s.stats || { days: {} };
  state = s;
  flush();
}

export function markSeeded() { state.seeded = true; save(); }
