import * as S from './store.js';
import { schedule, previewLabel, isDue, startOfDay } from './srs.js';
import { SEED } from './seed.js';
import * as X from './extract.js';

// ---------- 小道具 ----------
const $ = (sel, root = document) => root.querySelector(sel);
const app = $('#app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sample = (a, n) => shuffle(a).slice(0, n);
const norm = (s) => String(s || '').replace(/[\s\-~.,!?。、・()（）\[\]"'“”‘’…]/g, '').toLowerCase();

function highlight(sentence, target) {
  const s = esc(sentence);
  if (!target) return s;
  const t = esc(target);
  const i = s.indexOf(t);
  if (i < 0) return s;
  return s.slice(0, i) + '<mark>' + t + '</mark>' + s.slice(i + t.length);
}
function blankOut(sentence, target) {
  const i = sentence.indexOf(target);
  if (!target || i < 0) return null;
  return esc(sentence.slice(0, i)) + '<span class="blank">　？　</span>' + esc(sentence.slice(i + target.length));
}

function toast(msg, ms = 2200) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
}

function vibrate(p) { try { navigator.vibrate && navigator.vibrate(p); } catch {} }

// ---------- 読み上げ ----------
let koVoice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  koVoice = vs.find((v) => /ko[-_]KR/i.test(v.lang)) || vs.find((v) => /^ko/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
function speak(text) {
  if (!('speechSynthesis' in window) || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(String(text).replace(/^-/, '').replace(/[()（）]/g, ''));
  u.lang = 'ko-KR';
  if (koVoice) u.voice = koVoice;
  u.rate = S.settings().ttsRate || 0.9;
  speechSynthesis.speak(u);
}
const spk = (text) => `<button class="icon-btn speak" data-speak="${esc(text)}" aria-label="読み上げ">${ICON.speaker}</button>`;

const ICON = {
  speaker: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
  home: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
  gear: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  camera: '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  undo: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/></svg>',
  edit: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
};

// ---------- ルーター ----------
const routes = [];
const route = (re, fn) => routes.push([re, fn]);
let cleanup = null;

function render() {
  if (cleanup) { cleanup(); cleanup = null; }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  const hash = location.hash.slice(1) || '/';
  const [path, qs] = hash.split('?');
  const q = Object.fromEntries(new URLSearchParams(qs || ''));
  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (m) {
      const r = fn(...m.slice(1).map(decodeURIComponent), q);
      if (typeof r === 'function') cleanup = r;
      updateNav(path);
      window.scrollTo(0, 0);
      return;
    }
  }
  location.hash = '#/';
}
window.addEventListener('hashchange', render);
const go = (h) => { location.hash = h; };

function updateNav(path) {
  const nav = $('#nav');
  const hide = /^\/(study|quiz|match|review)/.test(path);
  nav.hidden = hide;
  document.body.classList.toggle('no-nav', hide);
  nav.querySelectorAll('a').forEach((a) => {
    const t = a.getAttribute('href').slice(1);
    a.classList.toggle('active', t === '/' ? path === '/' || path.startsWith('/deck') || path.startsWith('/browse') || path.startsWith('/edit') : path.startsWith(t));
  });
}

function header(title, backHref, right = '') {
  return `<header class="topbar">${backHref ? `<a class="icon-btn" href="${backHref}" aria-label="戻る">${ICON.back}</a>` : '<span class="brand-dot"></span>'}<h1>${esc(title)}</h1><div class="topbar-right">${right}</div></header>`;
}

// 共通クリック
document.addEventListener('click', (e) => {
  const sp = e.target.closest('[data-speak]');
  if (sp) { e.preventDefault(); e.stopPropagation(); speak(sp.dataset.speak); }
});

// ---------- ホーム ----------
route(/^\/$/, () => {
  const decks = S.decks();
  const t = S.todayStats();
  let dueAll = 0;
  const rows = decks.map((d) => {
    const c = S.deckCounts(d.id);
    dueAll += c.fresh + c.learn + c.review;
    return `<a class="deck-row" href="#/deck/${d.id}">
      <div class="deck-main"><div class="deck-name">${esc(d.name)}</div><div class="deck-sub">${c.total}枚</div></div>
      <div class="counts"><span class="c-new" title="新規">${c.fresh}</span><span class="c-learn" title="学習中">${c.learn}</span><span class="c-rev" title="復習">${c.review}</span></div>
    </a>`;
  }).join('');
  const acc = t.reviews ? Math.round((t.correct / t.reviews) * 100) + '%' : '—';
  app.innerHTML = `
    ${header('TOPIK 単語帳')}
    <main class="page">
      <section class="hero">
        <div class="stat"><b>${t.reviews + t.quiz}</b><span>今日の学習</span></div>
        <div class="stat"><b>${S.streak()}</b><span>連続日数</span></div>
        <div class="stat"><b>${acc}</b><span>正答率</span></div>
      </section>
      ${dueAll ? `<a class="btn primary block big" href="#/study/all">今日の復習をまとめて始める <small>${dueAll}枚</small></a>` : decks.length ? '<div class="done-banner">今日の復習は完了しています 🎉</div>' : ''}
      <div class="section-head"><h2>単語帳</h2><span class="legend"><i class="c-new">新規</i><i class="c-learn">学習中</i><i class="c-rev">復習</i></span></div>
      <div class="deck-list">${rows || '<p class="empty">単語帳がありません。「追加」から作りましょう。</p>'}</div>
      <div class="row gap">
        <a class="btn block" href="#/add">${ICON.camera}<span>写真から追加</span></a>
        <button class="btn block" id="newDeck">新しい単語帳</button>
      </div>
    </main>`;
  $('#newDeck').onclick = () => {
    const name = prompt('単語帳の名前');
    if (name) { const d = S.addDeck(name); go('#/deck/' + d.id); }
  };
});

// ---------- 単語帳 ----------
route(/^\/deck\/([^/]+)$/, (id) => {
  const d = S.deck(id);
  if (!d) return go('#/');
  const c = S.deckCounts(id);
  const cards = S.cardsOf(id);
  const due = c.fresh + c.learn + c.review;
  const hasCloze = cards.some((x) => x.examples.some((e) => e.target && e.ko.includes(e.target)));
  app.innerHTML = `
    ${header(d.name, '#/', `<button class="icon-btn" id="menu" aria-label="メニュー">⋯</button>`)}
    <main class="page">
      <section class="deck-summary">
        <div><b class="c-new">${c.fresh}</b><span>新規</span></div>
        <div><b class="c-learn">${c.learn}</b><span>学習中</span></div>
        <div><b class="c-rev">${c.review}</b><span>復習</span></div>
        <div><b>${c.total}</b><span>全体</span></div>
      </section>
      ${due ? `<a class="btn primary block big" href="#/study/${id}">復習を始める <small>${due}枚</small></a>`
        : `<div class="done-banner">今日の分は完了！${c.freshAll ? `<button class="link" id="more">新規カードをさらに学ぶ</button>` : ''}</div>`}
      <h2 class="section-title">いろいろな練習</h2>
      <div class="mode-grid">
        <a class="mode" href="#/quiz/${id}?m=choice"><span class="mode-ico">④</span><b>4択クイズ</b><small>意味を選ぶ</small></a>
        <a class="mode ${hasCloze ? '' : 'disabled'}" href="${hasCloze ? `#/quiz/${id}?m=cloze` : 'javascript:void 0'}"><span class="mode-ico">＿</span><b>穴埋め</b><small>${hasCloze ? '例文の空欄' : '例文がありません'}</small></a>
        <a class="mode" href="#/quiz/${id}?m=type"><span class="mode-ico">가</span><b>入力</b><small>ハングルで答える</small></a>
        <a class="mode ${cards.length >= 3 ? '' : 'disabled'}" href="${cards.length >= 3 ? `#/match/${id}` : 'javascript:void 0'}"><span class="mode-ico">⇄</span><b>マッチング</b><small>${d.bestMatch ? `ベスト ${(d.bestMatch / 1000).toFixed(1)}秒` : 'ペアを揃える'}</small></a>
      </div>
      <div class="row gap">
        <a class="btn block" href="#/browse/${id}">カード一覧・編集</a>
        <a class="btn block" href="#/add?deck=${id}">カードを追加</a>
      </div>
    </main>`;
  const more = $('#more');
  if (more) more.onclick = () => go(`#/study/${id}?extra=10`);
  $('#menu').onclick = () => sheet([
    ['名前を変更', () => { const n = prompt('新しい名前', d.name); if (n) { S.renameDeck(id, n); render(); } }],
    ['CSV で書き出し（Anki/Quizlet 用）', () => exportCsv(d)],
    ['学習履歴をリセット', () => { if (confirm('この単語帳の学習記録をすべて消して新規に戻しますか？')) { cards.forEach((x) => S.resetCard(x.id)); render(); } }],
    ['単語帳を削除', () => { if (confirm(`「${d.name}」を削除しますか？（${cards.length}枚）`)) { S.deleteDeck(id); go('#/'); } }, 'danger'],
  ]);
});

function sheet(items) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet">${items.map(([label, , cls], i) => `<button class="sheet-item ${cls || ''}" data-i="${i}">${esc(label)}</button>`).join('')}<button class="sheet-item cancel">キャンセル</button></div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('show'));
  const close = () => { wrap.classList.remove('show'); setTimeout(() => wrap.remove(), 200); };
  wrap.onclick = (e) => {
    const b = e.target.closest('[data-i]');
    close();
    if (b) items[+b.dataset.i][1]();
  };
}

function download(name, text, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function exportCsv(d) {
  const q = (s) => `"${String(s || '').replace(/"/g, '""')}"`;
  const lines = S.cardsOf(d.id).map((c) => [c.front, c.back, c.category, c.examples[0]?.ko, c.examples[0]?.ja].map(q).join(','));
  download(`${d.name}.csv`, '﻿' + lines.join('\n'), 'text/csv');
}

// ---------- カード一覧 ----------
route(/^\/browse\/([^/]+)$/, (id) => {
  const d = S.deck(id);
  if (!d) return go('#/');
  app.innerHTML = `
    ${header(d.name + ' の一覧', '#/deck/' + id)}
    <main class="page">
      <input class="search" id="q" type="search" placeholder="検索（韓国語・日本語）">
      <div id="list" class="card-list"></div>
    </main>`;
  const draw = () => {
    const q = $('#q').value.trim().toLowerCase();
    const cs = S.cardsOf(id).filter((c) => !q || (c.front + c.back + c.category + c.examples.map((e) => e.ko + e.ja).join('')).toLowerCase().includes(q));
    $('#list').innerHTML = cs.map((c) => `
      <a class="card-item" href="#/edit/${c.id}">
        <div class="ci-front">${esc(c.front)}</div>
        <div class="ci-back">${esc(c.back)}</div>
        <div class="ci-meta">${c.category ? `<span class="chip">${esc(c.category)}</span>` : ''}${stateChip(c)}</div>
      </a>`).join('') || '<p class="empty">該当するカードがありません</p>';
  };
  $('#q').oninput = draw;
  draw();
});

function stateChip(c) {
  const s = c.srs;
  if (s.state === 'new') return '<span class="chip c-new">新規</span>';
  if (s.state !== 'review') return '<span class="chip c-learn">学習中</span>';
  const days = Math.round((s.due - startOfDay()) / 86400000);
  return `<span class="chip c-rev">${days <= 0 ? '今日' : days + '日後'}</span>`;
}

// ---------- カード編集 ----------
route(/^\/edit\/([^/]+)$/, (cid) => {
  const c = S.card(cid);
  if (!c) return go('#/');
  app.innerHTML = `
    ${header('カードを編集', '#/browse/' + c.deckId)}
    <main class="page">${cardForm(c)}
      <div class="row gap">
        <button class="btn block primary" id="save">保存</button>
      </div>
      <div class="row gap">
        <button class="btn block" id="reset">学習記録をリセット</button>
        <button class="btn block danger" id="del">削除</button>
      </div>
    </main>`;
  bindCardForm();
  $('#save').onclick = () => { S.updateCard(cid, readCardForm()); toast('保存しました'); history.back(); };
  $('#reset').onclick = () => { S.resetCard(cid); toast('新規に戻しました'); };
  $('#del').onclick = () => { if (confirm('このカードを削除しますか？')) { S.deleteCard(cid); history.back(); } };
});

function cardForm(c = { type: 'vocab', front: '', back: '', category: '', note: '', examples: [] }) {
  const exs = c.examples.length ? c.examples : [];
  return `
    <form class="form" id="cardForm" onsubmit="return false">
      <div class="seg" role="radiogroup">
        <label><input type="radio" name="type" value="vocab" ${c.type !== 'grammar' ? 'checked' : ''}><span>単語</span></label>
        <label><input type="radio" name="type" value="grammar" ${c.type === 'grammar' ? 'checked' : ''}><span>文法</span></label>
      </div>
      <label class="field"><span>表（韓国語）</span><input name="front" value="${esc(c.front)}" lang="ko" required></label>
      <label class="field"><span>裏（日本語の意味）</span><input name="back" value="${esc(c.back)}" required></label>
      <label class="field"><span>カテゴリ（任意）</span><input name="category" value="${esc(c.category)}"></label>
      <label class="field"><span>メモ（任意）</span><textarea name="note" rows="2">${esc(c.note)}</textarea></label>
      <div class="ex-head"><b>例文</b><button type="button" class="btn small" id="addEx">＋例文</button></div>
      <div id="exs">${exs.map(exRow).join('')}</div>
    </form>`;
}
function exRow(e = { ko: '', ja: '', target: '', advanced: false }) {
  return `<div class="ex-edit">
    <label class="field"><span>例文（韓国語）</span><textarea data-k="ko" rows="2" lang="ko">${esc(e.ko)}</textarea></label>
    <label class="field"><span>訳</span><textarea data-k="ja" rows="2">${esc(e.ja)}</textarea></label>
    <label class="field"><span>穴埋めにする部分（例文中の語句）</span><input data-k="target" value="${esc(e.target)}" lang="ko"></label>
    <div class="row between"><label class="check"><input type="checkbox" data-k="advanced" ${e.advanced ? 'checked' : ''}> 上級</label><button type="button" class="link danger rm-ex">この例文を削除</button></div>
  </div>`;
}
function bindCardForm() {
  $('#addEx').onclick = () => $('#exs').insertAdjacentHTML('beforeend', exRow());
  $('#exs').onclick = (e) => { if (e.target.closest('.rm-ex')) e.target.closest('.ex-edit').remove(); };
}
function readCardForm() {
  const f = $('#cardForm');
  return {
    type: f.type.value,
    front: f.front.value.trim(),
    back: f.back.value.trim(),
    category: f.category.value.trim(),
    note: f.note.value.trim(),
    examples: [...f.querySelectorAll('.ex-edit')].map((el) => ({
      ko: el.querySelector('[data-k=ko]').value.trim(),
      ja: el.querySelector('[data-k=ja]').value.trim(),
      target: el.querySelector('[data-k=target]').value.trim(),
      advanced: el.querySelector('[data-k=advanced]').checked,
    })).filter((e) => e.ko),
  };
}

// ---------- 間隔反復の復習 ----------
function buildQueue(deckId, extraNew = 0) {
  const ids = deckId === 'all' ? S.decks().map((d) => d.id) : [deckId];
  const now = Date.now();
  const learn = [], review = [], fresh = [];
  for (const id of ids) {
    const cs = S.cardsOf(id);
    let left = S.newLeftToday(id) + extraNew;
    for (const c of cs) {
      if (c.srs.state === 'new') { if (left > 0) { fresh.push(c.id); left--; } }
      else if (isDue(c, now)) (c.srs.state === 'review' ? review : learn).push(c.id);
    }
  }
  return { learn, review: shuffle(review), fresh, extraNew };
}

route(/^\/study\/([^/]+)$/, (deckId, q) => {
  const extra = +(q.extra || 0);
  const title = deckId === 'all' ? 'すべての単語帳' : S.deck(deckId)?.name;
  if (!title) return go('#/');
  const back = deckId === 'all' ? '#/' : '#/deck/' + deckId;
  const queue = buildQueue(deckId, extra);
  let current = null, showing = false, done = 0, undoStack = [], counter = 0, reverse = false;
  const set = S.settings();

  function pickNext() {
    const now = Date.now();
    // 時間が来た学習中カード
    const dueLearn = queue.learn.map((id) => S.card(id)).filter((c) => c && c.srs.state !== 'review' && c.srs.state !== 'new' && c.srs.due <= now);
    if (dueLearn.length) return dueLearn.sort((a, b) => a.srs.due - b.srs.due)[0];
    counter++;
    if (queue.fresh.length && (!queue.review.length || counter % 4 === 0)) return S.card(queue.fresh.shift());
    if (queue.review.length) return S.card(queue.review.shift());
    if (queue.fresh.length) return S.card(queue.fresh.shift());
    // 先取り（20分以内）
    const ahead = queue.learn.map((id) => S.card(id)).filter((c) => c && c.srs.state !== 'review' && c.srs.due - now < 20 * 60000);
    if (ahead.length) return ahead.sort((a, b) => a.srs.due - b.srs.due)[0];
    return null;
  }

  function remaining() {
    const now = Date.now();
    const l = queue.learn.map((id) => S.card(id)).filter((c) => c && c.srs.state !== 'review' && c.srs.due - now < 20 * 60000).length;
    return { n: queue.fresh.length, l, r: queue.review.length };
  }

  function next() {
    current = pickNext();
    showing = false;
    if (!current) return finish();
    reverse = set.direction === 'ja2ko' || (set.direction === 'mix' && Math.random() < 0.5);
    draw();
    if (set.autoSpeak && !reverse) speak(current.front);
  }

  function draw() {
    const c = current;
    const r = remaining();
    const total = done + r.n + r.l + r.r + 1;
    const qSide = reverse ? `<div class="q-ja">${esc(c.back)}</div>` : `<div class="q-ko" lang="ko">${esc(c.front)}</div>${spk(c.front)}`;
    const aSide = reverse
      ? `<div class="a-ko" lang="ko">${esc(c.front)} ${spk(c.front)}</div>`
      : `<div class="a-ja">${esc(c.back)}</div>`;
    const ex = c.examples.map((e) => `
      <div class="ex ${e.advanced ? 'adv' : ''}">
        <div class="ex-ko" lang="ko">${highlight(e.ko, e.target)} ${spk(e.ko)}</div>
        ${e.ja ? `<div class="ex-ja">${esc(e.ja)}</div>` : ''}
        ${e.advanced ? '<span class="badge">上級</span>' : ''}
      </div>`).join('');
    app.innerHTML = `
      <header class="topbar study">
        <a class="icon-btn" href="${back}" aria-label="終了">${ICON.close}</a>
        <div class="q-counts"><span class="c-new ${c.srs.state === 'new' ? 'cur' : ''}">${r.n + (c.srs.state === 'new' ? 1 : 0)}</span><span class="c-learn ${c.srs.state === 'learning' || c.srs.state === 'relearning' ? 'cur' : ''}">${r.l + (c.srs.state === 'learning' || c.srs.state === 'relearning' ? 1 : 0)}</span><span class="c-rev ${c.srs.state === 'review' ? 'cur' : ''}">${r.r + (c.srs.state === 'review' ? 1 : 0)}</span></div>
        <button class="icon-btn" id="undo" ${undoStack.length ? '' : 'disabled'} aria-label="元に戻す">${ICON.undo}</button>
      </header>
      <div class="progress"><i style="width:${Math.round((done / total) * 100)}%"></i></div>
      <main class="study-main">
        <div class="flash ${showing ? 'open' : ''}" id="flash">
          ${c.category ? `<span class="chip">${esc(c.category)}</span>` : ''}
          <div class="q">${qSide}</div>
          ${showing ? `<hr><div class="a">${aSide}${c.note ? `<div class="note">${esc(c.note)}</div>` : ''}<div class="exs">${ex}</div></div>`
            : '<p class="tap-hint">タップして答えを見る</p>'}
        </div>
      </main>
      <footer class="answer-bar">
        ${showing ? [1, 2, 3, 4].map((g) => `<button class="rate r${g}" data-r="${g}"><small>${previewLabel(c.srs, g)}</small>${['', 'もう一度', '難しい', '正解', '簡単'][g]}</button>`).join('')
          : '<button class="btn primary block big" id="show">答えを見る</button>'}
      </footer>`;
    $('#flash').onclick = (e) => { if (!showing && !e.target.closest('[data-speak]')) reveal(); };
    const sb = $('#show');
    if (sb) sb.onclick = reveal;
    document.querySelectorAll('[data-r]').forEach((b) => (b.onclick = () => rate(+b.dataset.r)));
    $('#undo').onclick = undo;
  }

  function reveal() {
    showing = true;
    draw();
    if (set.autoSpeak && reverse) speak(current.front);
  }

  function rate(g) {
    const c = current;
    const wasNew = c.srs.state === 'new';
    undoStack.push({ id: c.id, srs: { ...c.srs }, wasNew, queue: JSON.parse(JSON.stringify(queue)), done });
    if (undoStack.length > 20) undoStack.shift();
    const ns = schedule(c.srs, g);
    S.updateCard(c.id, { srs: ns });
    S.recordReview(c, g, wasNew);
    if (ns.state !== 'review') { if (!queue.learn.includes(c.id)) queue.learn.push(c.id); }
    else { queue.learn = queue.learn.filter((x) => x !== c.id); done++; }
    vibrate(g === 1 ? [20, 40, 20] : 10);
    next();
  }

  function undo() {
    const u = undoStack.pop();
    if (!u) return;
    S.updateCard(u.id, { srs: u.srs });
    Object.assign(queue, u.queue);
    done = u.done;
    current = S.card(u.id);
    showing = false;
    draw();
  }

  function finish() {
    const t = S.todayStats();
    app.innerHTML = `
      ${header('お疲れさまでした', back)}
      <main class="page center">
        <div class="finish-emoji">🎉</div>
        <h2>今日の復習が終わりました</h2>
        <p class="muted">今日の学習: ${t.reviews}回 ／ 正答率 ${t.reviews ? Math.round((t.correct / t.reviews) * 100) : 0}%</p>
        <a class="btn primary block" href="${back}">戻る</a>
        ${deckId !== 'all' ? `<a class="btn block" href="#/quiz/${deckId}?m=choice">4択クイズで確認する</a>` : ''}
      </main>`;
  }

  const onKey = (e) => {
    if (!current) return;
    if (!showing && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); reveal(); }
    else if (showing && /^[1-4]$/.test(e.key)) rate(+e.key);
  };
  document.addEventListener('keydown', onKey);
  next();
  return () => document.removeEventListener('keydown', onKey);
});

// ---------- クイズ（4択・穴埋め・入力） ----------
function clozeItems(cards) {
  const out = [];
  for (const c of cards) for (const e of c.examples) if (e.target && e.ko.includes(e.target)) out.push({ card: c, ex: e });
  return out;
}

function makeQuestions(cards, mode, n = 10) {
  const dir = S.settings().direction;
  const qs = [];
  if (mode === 'cloze') {
    const items = clozeItems(cards);
    const targets = [...new Set(items.map((i) => i.ex.target))];
    for (const it of sample(items, n)) {
      // 同じカードの言い換え（正解になり得る）を選択肢から外す
      const sameCard = new Set(it.card.examples.map((e) => e.target));
      const pool = targets.filter((t) => !sameCard.has(t));
      const opts = shuffle([it.ex.target, ...sample(pool, 3)]);
      qs.push({ card: it.card, kind: 'cloze', html: blankOut(it.ex.ko, it.ex.target), hint: it.ex.ja, answer: it.ex.target, opts, full: it.ex.ko });
    }
    return qs;
  }
  for (const c of sample(cards, n)) {
    const rev = dir === 'ja2ko' || (dir === 'mix' && Math.random() < 0.5);
    if (mode === 'type') {
      const exs = c.examples.filter((e) => e.target && e.ko.includes(e.target));
      if (c.type === 'grammar' && exs.length) {
        const e = exs[Math.floor(Math.random() * exs.length)];
        qs.push({ card: c, kind: 'type', html: blankOut(e.ko, e.target), hint: `${e.ja}（${c.front}）`, answer: e.target, full: e.ko });
      } else {
        qs.push({ card: c, kind: 'type', prompt: c.back, sub: c.category, answer: c.front, full: c.front });
      }
      continue;
    }
    const others = cards.filter((x) => x.id !== c.id);
    const field = rev ? 'front' : 'back';
    const pool = [...new Set(others.map((x) => x[field]).filter((v) => v !== c[field]))];
    const opts = shuffle([c[field], ...sample(pool, 3)]);
    qs.push({ card: c, kind: 'choice', prompt: rev ? c.back : c.front, promptKo: !rev, answer: c[field], opts, optKo: rev, sub: c.category });
  }
  return qs;
}

route(/^\/quiz\/([^/]+)$/, (deckId, q) => {
  const d = S.deck(deckId);
  if (!d) return go('#/');
  const mode = q.m || 'choice';
  const cards = q.ids ? q.ids.split(',').map(S.card).filter(Boolean) : S.cardsOf(deckId);
  if (cards.length < 2) { toast('カードが2枚以上必要です'); return go('#/deck/' + deckId); }
  const questions = makeQuestions(cards, mode, Math.min(10, cards.length * (mode === 'cloze' ? 3 : 1)));
  if (!questions.length) { toast('出題できる問題がありません'); return go('#/deck/' + deckId); }
  let i = 0, score = 0, answered = false;
  const wrong = [];
  const title = { choice: '4択クイズ', cloze: '穴埋め', type: '入力' }[mode];

  function draw() {
    const qq = questions[i];
    answered = false;
    let body;
    if (qq.kind === 'choice') {
      body = `<div class="quiz-q">${qq.sub ? `<span class="chip">${esc(qq.sub)}</span>` : ''}<div class="${qq.promptKo ? 'q-ko' : 'q-ja'}" ${qq.promptKo ? 'lang="ko"' : ''}>${esc(qq.prompt)}</div>${qq.promptKo ? spk(qq.prompt) : ''}</div>
        <div class="opts">${qq.opts.map((o, k) => `<button class="opt ${qq.optKo ? 'ko' : ''}" data-o="${k}">${esc(o)}</button>`).join('')}</div>`;
    } else if (qq.kind === 'cloze') {
      body = `<div class="quiz-q"><div class="cloze" lang="ko">${qq.html}</div><div class="hint">${esc(qq.hint)}</div></div>
        <div class="opts">${qq.opts.map((o, k) => `<button class="opt ko" data-o="${k}">${esc(o)}</button>`).join('')}</div>`;
    } else {
      body = `<div class="quiz-q">${qq.html ? `<div class="cloze" lang="ko">${qq.html}</div><div class="hint">${esc(qq.hint)}</div>` : `${qq.sub ? `<span class="chip">${esc(qq.sub)}</span>` : ''}<div class="q-ja">${esc(qq.prompt)}</div>`}</div>
        <form class="type-form" id="tf"><input id="ans" lang="ko" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="ハングルで入力"><button class="btn primary">答える</button></form>
        <button class="link" id="giveup">わからない</button>
        <div id="fb"></div>`;
    }
    app.innerHTML = `
      <header class="topbar study"><a class="icon-btn" href="#/deck/${deckId}" aria-label="終了">${ICON.close}</a><h1>${title}</h1><div class="topbar-right score">${i + 1}/${questions.length}</div></header>
      <div class="progress"><i style="width:${(i / questions.length) * 100}%"></i></div>
      <main class="study-main quiz">${body}</main>
      <footer class="answer-bar" id="nextBar" hidden><button class="btn primary block big" id="next">次へ</button></footer>`;
    app.querySelectorAll('[data-o]').forEach((b) => (b.onclick = () => choose(+b.dataset.o)));
    const tf = $('#tf');
    if (tf) {
      setTimeout(() => $('#ans').focus(), 50);
      tf.onsubmit = (e) => { e.preventDefault(); if (!answered) checkTyped($('#ans').value); };
      $('#giveup').onclick = () => { if (!answered) checkTyped(''); };
    }
    $('#next').onclick = advance;
  }

  function result(ok) {
    answered = true;
    const qq = questions[i];
    if (ok) score++; else wrong.push(qq.card.id);
    S.recordQuiz(ok);
    vibrate(ok ? 10 : [20, 40, 20]);
    if (qq.full) speak(qq.full);
    $('#nextBar').hidden = false;
    if (qq.kind !== 'type' && ok) setTimeout(() => { if (questions[i] === qq) advance(); }, 900);
  }

  function choose(k) {
    if (answered) return;
    const qq = questions[i];
    const ok = qq.opts[k] === qq.answer;
    app.querySelectorAll('[data-o]').forEach((b) => {
      const o = qq.opts[+b.dataset.o];
      if (o === qq.answer) b.classList.add('correct');
      else if (+b.dataset.o === k) b.classList.add('wrong');
      b.disabled = true;
    });
    if (qq.kind === 'cloze') $('.cloze').innerHTML = highlight(qq.full, qq.answer);
    if (!ok && qq.kind === 'choice') $('.quiz-q').insertAdjacentHTML('beforeend', `<div class="fb-detail">${esc(qq.card.front)} ＝ ${esc(qq.card.back)}</div>`);
    result(ok);
  }

  function checkTyped(v) {
    const qq = questions[i];
    const ok = !!v && norm(v) === norm(qq.answer);
    $('#ans').disabled = true;
    if (qq.html) $('.cloze').innerHTML = highlight(qq.full, qq.answer);
    $('#fb').innerHTML = ok
      ? `<div class="fb ok">正解！ <b lang="ko">${esc(qq.answer)}</b></div>`
      : `<div class="fb ng">${v ? `あなたの答え: <s lang="ko">${esc(v)}</s><br>` : ''}正解: <b lang="ko">${esc(qq.answer)}</b> ${spk(qq.answer)}</div>
         ${v ? '<button class="link" id="override">実は合ってた（正解にする）</button>' : ''}`;
    $('#giveup').hidden = true;
    const ov = $('#override');
    if (ov) ov.onclick = () => { score++; wrong.pop(); S.recordQuiz(true); ov.remove(); $('.fb').className = 'fb ok'; };
    result(ok);
    $('#next').focus();
  }

  function advance() {
    i++;
    if (i < questions.length) draw();
    else finish();
  }

  function finish() {
    const pct = Math.round((score / questions.length) * 100);
    const wrongCards = [...new Set(wrong)].map(S.card).filter(Boolean);
    app.innerHTML = `
      ${header(title + ' の結果', '#/deck/' + deckId)}
      <main class="page center">
        <div class="score-ring" style="--p:${pct}"><b>${score}</b><span>/ ${questions.length}</span></div>
        <p class="muted">${pct === 100 ? '全問正解！完璧です' : pct >= 70 ? 'いい調子です' : 'もう一度やってみましょう'}</p>
        ${wrongCards.length ? `<h3 class="section-title left">間違えたカード</h3><div class="card-list">${wrongCards.map((c) => `<div class="card-item"><div class="ci-front">${esc(c.front)} ${spk(c.front)}</div><div class="ci-back">${esc(c.back)}</div></div>`).join('')}</div>
          <a class="btn primary block" href="#/quiz/${deckId}?m=${mode}&ids=${wrongCards.map((c) => c.id).join(',')}&r=${Date.now()}">間違えた問題だけもう一度</a>` : ''}
        <a class="btn block" href="#/quiz/${deckId}?m=${mode}&r=${Date.now()}">新しい問題で続ける</a>
        <a class="btn block" href="#/deck/${deckId}">単語帳に戻る</a>
      </main>`;
  }

  const onKey = (e) => {
    if (answered && e.key === 'Enter' && document.activeElement?.id !== 'ans') { e.preventDefault(); advance(); }
    else if (!answered && /^[1-4]$/.test(e.key) && questions[i].opts) choose(+e.key - 1);
  };
  document.addEventListener('keydown', onKey);
  draw();
  return () => document.removeEventListener('keydown', onKey);
});

// ---------- マッチング ----------
route(/^\/match\/([^/]+)$/, (deckId) => {
  const d = S.deck(deckId);
  if (!d) return go('#/');
  const pairs = sample(S.cardsOf(deckId), 6);
  const tiles = shuffle(pairs.flatMap((c) => [{ id: c.id, text: c.front, ko: true }, { id: c.id, text: c.back, ko: false }]));
  let sel = null, left = pairs.length, misses = 0;
  const t0 = Date.now();
  app.innerHTML = `
    <header class="topbar study"><a class="icon-btn" href="#/deck/${deckId}" aria-label="終了">${ICON.close}</a><h1>マッチング</h1><div class="topbar-right score" id="timer">0.0</div></header>
    <main class="study-main"><div class="match-grid">${tiles.map((t, k) => `<button class="tile ${t.ko ? 'ko' : ''}" data-k="${k}" ${t.ko ? 'lang="ko"' : ''}>${esc(t.text)}</button>`).join('')}</div></main>`;
  const timer = setInterval(() => { const el = $('#timer'); if (el) el.textContent = ((Date.now() - t0) / 1000).toFixed(1); }, 100);
  app.querySelectorAll('.tile').forEach((b) => (b.onclick = () => {
    const k = +b.dataset.k;
    if (b.classList.contains('gone')) return;
    if (sel === null) { sel = k; b.classList.add('sel'); if (tiles[k].ko) speak(tiles[k].text); return; }
    if (sel === k) { b.classList.remove('sel'); sel = null; return; }
    const a = app.querySelector(`[data-k="${sel}"]`);
    if (tiles[sel].id === tiles[k].id && tiles[sel].ko !== tiles[k].ko) {
      a.classList.add('gone'); b.classList.add('gone');
      vibrate(10);
      if (--left === 0) win();
    } else {
      misses++;
      a.classList.add('bad'); b.classList.add('bad');
      vibrate([20, 40, 20]);
      setTimeout(() => { a.classList.remove('bad', 'sel'); b.classList.remove('bad'); }, 400);
    }
    a.classList.remove('sel');
    sel = null;
  }));
  function win() {
    clearInterval(timer);
    const ms = Date.now() - t0 + misses * 1000;
    const best = !d.bestMatch || ms < d.bestMatch;
    if (best) { d.bestMatch = ms; S.save(); }
    app.innerHTML = `
      ${header('マッチング', '#/deck/' + deckId)}
      <main class="page center">
        <div class="finish-emoji">${best ? '🏆' : '✨'}</div>
        <h2>${(ms / 1000).toFixed(1)} 秒</h2>
        <p class="muted">ミス ${misses}回（1回につき +1秒）${best ? '<br>自己ベスト更新！' : `<br>ベスト ${(d.bestMatch / 1000).toFixed(1)}秒`}</p>
        <a class="btn primary block" href="#/match/${deckId}?r=${Date.now()}">もう一度</a>
        <a class="btn block" href="#/deck/${deckId}">単語帳に戻る</a>
      </main>`;
  }
  return () => clearInterval(timer);
});

// ---------- 追加（写真・貼り付け・手入力） ----------
let pending = null; // 取り込み確認待ちのカード { deckName, cards }
let photos = []; // { dataUrl, base64 }

route(/^\/add$/, (q) => {
  const tab = q.tab || 'photo';
  const targetDeck = q.deck || '';
  const tabs = [['photo', '写真から'], ['paste', '貼り付け'], ['manual', '手入力']];
  app.innerHTML = `
    ${header('カードを追加', targetDeck ? '#/deck/' + targetDeck : '')}
    <main class="page">
      <nav class="tabs">${tabs.map(([k, l]) => `<a href="#/add?tab=${k}${targetDeck ? '&deck=' + targetDeck : ''}" class="${tab === k ? 'on' : ''}">${l}</a>`).join('')}</nav>
      <div id="tabBody"></div>
    </main>`;
  const body = $('#tabBody');

  if (tab === 'photo') {
    const hasKey = !!S.settings().apiKey;
    const drawPhotos = () => {
      $('#thumbs').innerHTML = photos.map((p, k) => `<div class="thumb"><img src="${p.dataUrl}" alt=""><button data-rm="${k}" aria-label="削除">×</button></div>`).join('');
      $('#photoActions').hidden = !photos.length;
    };
    body.innerHTML = `
      <p class="muted">教材の表を撮影するか、ギャラリーから選んでください。複数枚まとめて読み取れます。</p>
      <div class="row gap">
        <label class="btn block pick">${ICON.camera}<span>撮影する</span><input type="file" accept="image/*" capture="environment" id="cam" hidden></label>
        <label class="btn block pick"><span>🖼</span><span>写真を選ぶ</span><input type="file" accept="image/*" multiple id="gal" hidden></label>
      </div>
      <div class="thumbs" id="thumbs"></div>
      <div id="photoActions" hidden>
        <button class="btn primary block big" id="runApi" ${hasKey ? '' : 'disabled'}>Claude API で読み取る</button>
        ${hasKey ? '' : '<p class="hint-box">API で自動読み取りするには <a href="#/settings">設定</a> で API キーを入力してください。<br>キーがなくても下の方法で無料で変換できます。</p>'}
      </div>
      <details class="howto" ${hasKey ? '' : 'open'}>
        <summary>Claude アプリで変換する（API キー不要）</summary>
        <ol>
          <li>下のボタンで変換用の指示文をコピー</li>
          <li>Claude アプリを開き、写真を添付して指示文を貼り付けて送信</li>
          <li>返ってきた JSON を全部コピーして、下の欄に貼り付け</li>
        </ol>
        <button class="btn block" id="copyPrompt">指示文をコピー</button>
        <textarea id="pasteJson" rows="5" placeholder="ここに Claude の返答を貼り付け"></textarea>
        <button class="btn primary block" id="readJson">読み込む</button>
      </details>
      <div id="status"></div>`;
    drawPhotos();
    const onFiles = async (files) => {
      for (const f of files) {
        try { photos.push(await X.resizeImage(f)); } catch (e) { toast(e.message); }
      }
      drawPhotos();
    };
    $('#cam').onchange = (e) => onFiles([...e.target.files]);
    $('#gal').onchange = (e) => onFiles([...e.target.files]);
    $('#thumbs').onclick = (e) => { const b = e.target.closest('[data-rm]'); if (b) { photos.splice(+b.dataset.rm, 1); drawPhotos(); } };
    $('#copyPrompt').onclick = async () => {
      try { await navigator.clipboard.writeText(X.buildChatPrompt()); toast('コピーしました'); }
      catch { prompt('コピーしてください', X.buildChatPrompt()); }
    };
    $('#readJson').onclick = () => {
      try { pending = X.parseCardsJson($('#pasteJson').value); go(`#/review${targetDeck ? '?deck=' + targetDeck : ''}`); }
      catch (e) { toast(e.message, 3500); }
    };
    let ctrl = null;
    $('#runApi').onclick = async () => {
      if (!photos.length) return;
      ctrl = new AbortController();
      $('#status').innerHTML = `<div class="loading"><span class="spinner"></span><span>${photos.length}枚の写真を読み取り中…<br><small>30秒〜1分ほどかかります</small></span><button class="link" id="cancel">中止</button></div>`;
      $('#runApi').disabled = true;
      $('#cancel').onclick = () => ctrl.abort();
      try {
        const res = await X.extractWithClaude(photos, { signal: ctrl.signal });
        if (!res.cards.length) throw new Error('表からカードを見つけられませんでした');
        pending = res;
        photos = [];
        go(`#/review${targetDeck ? '?deck=' + targetDeck : ''}`);
      } catch (e) {
        if (!$('#status')) return;
        $('#status').innerHTML = `<div class="hint-box error">${esc(e.name === 'AbortError' || /abort/i.test(e.message) ? '中止しました' : e.message)}</div>`;
        $('#runApi').disabled = false;
      }
    };
    return () => ctrl && ctrl.abort();
  }

  if (tab === 'paste') {
    body.innerHTML = `
      <p class="muted">Anki・Quizlet の書き出し（タブ区切り / CSV：表, 裏, カテゴリ, 例文, 訳）や、Claude の JSON 出力をそのまま貼り付けられます。</p>
      <textarea id="paste" rows="10" placeholder="안녕하세요\tこんにちは&#10;감사합니다\tありがとう"></textarea>
      <label class="btn block pick"><span>ファイルから読み込む（.csv / .txt / .json）</span><input type="file" id="file" accept=".csv,.txt,.tsv,.json,text/*" hidden></label>
      <button class="btn primary block big" id="go">確認画面へ</button>`;
    $('#file').onchange = async (e) => { const f = e.target.files[0]; if (f) $('#paste').value = await f.text(); };
    $('#go').onclick = () => {
      const t = $('#paste').value.trim();
      if (!t) return toast('内容を貼り付けてください');
      try {
        pending = /^\s*(```|\{|\[)/.test(t) ? X.parseCardsJson(t) : { deckName: '', cards: X.parseDelimited(t) };
        if (!pending.cards.length) throw new Error('カードが見つかりません');
        go(`#/review${targetDeck ? '?deck=' + targetDeck : ''}`);
      } catch (e) { toast(e.message, 3500); }
    };
    return;
  }

  // 手入力
  const decks = S.decks();
  body.innerHTML = `
    <label class="field"><span>追加先</span><select id="dk">${decks.map((d) => `<option value="${d.id}" ${d.id === targetDeck ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}<option value="__new">＋ 新しい単語帳</option></select></label>
    ${cardForm()}
    <button class="btn primary block big" id="addOne">追加して次へ</button>`;
  bindCardForm();
  $('#addOne').onclick = () => {
    const c = readCardForm();
    if (!c.front || !c.back) return toast('表と裏を入力してください');
    let deckId = $('#dk').value;
    if (deckId === '__new') { const n = prompt('単語帳の名前'); if (!n) return; deckId = S.addDeck(n).id; }
    const r = S.addCards(deckId, [c]);
    toast(r.added ? '追加しました' : '同じカードがすでにあります');
    go(`#/add?tab=manual&deck=${deckId}&r=${Date.now()}`);
  };
});

// 取り込み確認画面
route(/^\/review$/, (q) => {
  if (!pending) return go('#/add');
  const decks = S.decks();
  const items = pending.cards.map((c) => ({ ...c, _on: true }));
  app.innerHTML = `
    ${header('取り込み内容の確認', '#/add')}
    <main class="page">
      <p class="muted">${items.length}枚見つかりました。不要なものはチェックを外し、間違いはタップして直してください。</p>
      <label class="field"><span>追加先</span><select id="dk">
        <option value="__new">＋ 新しい単語帳：${esc(pending.deckName || '写真から')}</option>
        ${decks.map((d) => `<option value="${d.id}" ${d.id === q.deck ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}
      </select></label>
      <label class="field" id="nameField"><span>新しい単語帳の名前</span><input id="dn" value="${esc(pending.deckName || '写真から ' + new Date().toLocaleDateString('ja-JP'))}"></label>
      <div class="row between"><button class="link" id="all">すべて選択</button><button class="link" id="none">すべて解除</button></div>
      <div class="review-list" id="rl"></div>
    </main>
    <footer class="answer-bar"><button class="btn primary block big" id="save"></button></footer>`;
  const dk = $('#dk');
  const syncName = () => { $('#nameField').hidden = dk.value !== '__new'; };
  dk.onchange = syncName;
  syncName();
  const drawList = () => {
    $('#rl').innerHTML = items.map((c, k) => `
      <div class="rv ${c._on ? '' : 'off'}" data-k="${k}">
        <label class="rv-check"><input type="checkbox" ${c._on ? 'checked' : ''} data-on="${k}"></label>
        <div class="rv-body">
          <div class="rv-top"><span class="chip ${c.type === 'grammar' ? 'c-learn' : 'c-new'}">${c.type === 'grammar' ? '文法' : '単語'}</span>${c.category ? `<span class="chip">${esc(c.category)}</span>` : ''}</div>
          <input class="rv-front" data-f="front" data-k="${k}" value="${esc(c.front)}" lang="ko">
          <input class="rv-back" data-f="back" data-k="${k}" value="${esc(c.back)}">
          ${c.note ? `<div class="note small">${esc(c.note)}</div>` : ''}
          ${(c.examples || []).length ? `<details><summary>例文 ${c.examples.length}件</summary>${c.examples.map((e) => `<div class="ex ${e.advanced ? 'adv' : ''}"><div class="ex-ko" lang="ko">${highlight(e.ko, e.target)}</div><div class="ex-ja">${esc(e.ja)}</div></div>`).join('')}</details>` : ''}
        </div>
      </div>`).join('');
    $('#save').textContent = `${items.filter((c) => c._on).length}枚を追加`;
  };
  drawList();
  $('#rl').onchange = (e) => {
    const on = e.target.dataset.on;
    if (on !== undefined) { items[+on]._on = e.target.checked; drawList(); }
  };
  $('#rl').oninput = (e) => { const f = e.target.dataset.f; if (f) items[+e.target.dataset.k][f] = e.target.value; };
  $('#all').onclick = () => { items.forEach((c) => (c._on = true)); drawList(); };
  $('#none').onclick = () => { items.forEach((c) => (c._on = false)); drawList(); };
  $('#save').onclick = () => {
    const chosen = items.filter((c) => c._on);
    if (!chosen.length) return toast('カードを選んでください');
    let deckId = dk.value;
    if (deckId === '__new') deckId = S.addDeck($('#dn').value).id;
    const r = S.addCards(deckId, chosen);
    pending = null;
    toast(`${r.added}枚追加しました${r.skipped ? `（重複など${r.skipped}枚はスキップ）` : ''}`, 3000);
    go('#/deck/' + deckId);
  };
});

// ---------- 設定 ----------
route(/^\/settings$/, () => {
  const s = S.settings();
  app.innerHTML = `
    ${header('設定')}
    <main class="page">
      <section class="group">
        <h2>学習</h2>
        <label class="field"><span>1日の新規カード数（単語帳ごと）</span><input type="number" id="npd" min="0" max="500" value="${s.newPerDay}" inputmode="numeric"></label>
        <label class="field"><span>出題の向き</span><select id="dir">
          <option value="ko2ja" ${s.direction === 'ko2ja' ? 'selected' : ''}>韓国語 → 日本語</option>
          <option value="ja2ko" ${s.direction === 'ja2ko' ? 'selected' : ''}>日本語 → 韓国語</option>
          <option value="mix" ${s.direction === 'mix' ? 'selected' : ''}>ランダム</option></select></label>
        <label class="switch"><input type="checkbox" id="auto" ${s.autoSpeak ? 'checked' : ''}><span>韓国語を自動で読み上げる</span></label>
        <label class="field"><span>読み上げの速さ <b id="rateV">${s.ttsRate}</b></span><input type="range" id="rate" min="0.5" max="1.3" step="0.05" value="${s.ttsRate}"></label>
        <button class="btn block" id="testTts">${ICON.speaker}<span>読み上げテスト</span></button>
      </section>
      <section class="group">
        <h2>写真の読み取り（Claude API）</h2>
        <p class="muted small">キーはこの端末の中だけに保存され、読み取りのときに Anthropic へ直接送られます。料金は使った分だけ（写真1枚あたり数円程度）です。キーは console.anthropic.com で作れます。</p>
        <label class="field"><span>API キー</span><input type="password" id="key" value="${esc(s.apiKey)}" placeholder="sk-ant-..." autocomplete="off"></label>
        <label class="field"><span>モデル</span><select id="model">
          <option value="claude-opus-5-5" ${s.model === 'claude-opus-5-5' ? 'selected' : ''}>Claude Opus 5.5（高精度・おすすめ）</option>
          <option value="claude-sonnet-5-5" ${s.model === 'claude-sonnet-5-5' ? 'selected' : ''}>Claude Sonnet 5.5（安め）</option>
          <option value="claude-haiku-5-5" ${s.model === 'claude-haiku-5-5' ? 'selected' : ''}>Claude Haiku 5.5（最安・精度は低め）</option></select></label>
        <label class="field"><span>自分の変換ルール（任意・読み取り時に優先されます）</span><textarea id="rules" rows="4" placeholder="例：赤字の例文は取り込まない／カテゴリには級を入れる">${esc(s.extraRules)}</textarea></label>
      </section>
      <section class="group">
        <h2>バックアップ</h2>
        <p class="muted small">データはこの端末のブラウザに保存されています。機種変更やブラウザのデータ削除に備えて、ときどき書き出してください。</p>
        <button class="btn block" id="exp">バックアップを書き出す</button>
        <label class="btn block pick"><span>バックアップから復元</span><input type="file" id="imp" accept=".json,application/json" hidden></label>
        <button class="btn block" id="seed">サンプル単語帳を追加</button>
      </section>
      <p class="muted small center">TOPIK 単語帳 · 無料・オフライン対応</p>
    </main>`;
  const bind = (id, ev, fn) => ($('#' + id)[ev] = fn);
  bind('npd', 'onchange', (e) => S.setSettings({ newPerDay: Math.max(0, +e.target.value || 0) }));
  bind('dir', 'onchange', (e) => S.setSettings({ direction: e.target.value }));
  bind('auto', 'onchange', (e) => S.setSettings({ autoSpeak: e.target.checked }));
  bind('rate', 'oninput', (e) => { S.setSettings({ ttsRate: +e.target.value }); $('#rateV').textContent = e.target.value; });
  bind('testTts', 'onclick', () => speak('안녕하세요. 토픽 시험 화이팅!'));
  bind('key', 'onchange', (e) => { S.setSettings({ apiKey: e.target.value.trim() }); toast('保存しました'); });
  bind('model', 'onchange', (e) => S.setSettings({ model: e.target.value }));
  bind('rules', 'onchange', (e) => S.setSettings({ extraRules: e.target.value }));
  bind('exp', 'onclick', () => download(`topik-backup-${S.dayKey()}.json`, S.exportAll(), 'application/json'));
  bind('imp', 'onchange', async (e) => {
    const f = e.target.files[0];
    if (!f || !confirm('今のデータを上書きして復元しますか？')) return;
    try { S.importAll(await f.text()); toast('復元しました'); go('#/'); } catch (err) { toast('復元できませんでした: ' + err.message, 3500); }
  });
  bind('seed', 'onclick', () => { addSeed(); toast('サンプルを追加しました'); go('#/'); });
});

function addSeed() {
  for (const d of SEED) {
    const existing = S.decks().find((x) => x.name === d.name);
    const deck = existing || S.addDeck(d.name);
    S.addCards(deck.id, d.cards);
  }
  S.markSeeded();
}

// ---------- 起動 ----------
if (!S.getState().seeded && !S.decks().length) addSeed();
render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
