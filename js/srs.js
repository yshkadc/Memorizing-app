// Anki 風の間隔反復（SM-2 をベースにした簡易版）
// card.srs = { state: 'new'|'learning'|'review'|'relearning', due: ms, ivl: 日数, ease, reps, lapses, step }

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

export const LEARN_STEPS = [1, 10]; // 分
export const RELEARN_STEPS = [10]; // 分
export const GRAD_IVL = 1; // 日
export const EASY_IVL = 4; // 日

export function newSrs() {
  return { state: 'new', due: 0, ivl: 0, ease: 2.5, reps: 0, lapses: 0, step: 0 };
}

// 日付は「朝4時」区切り（Anki と同じ考え方）
export function startOfDay(t = Date.now()) {
  const d = new Date(t - 4 * 60 * MIN);
  d.setHours(0, 0, 0, 0);
  return d.getTime() + 4 * 60 * MIN;
}

function dueInDays(days, now) {
  return startOfDay(now) + Math.round(days) * DAY;
}

function fuzz(ivl) {
  if (ivl < 3) return ivl;
  const f = Math.max(1, Math.round(ivl * 0.05));
  return ivl + Math.floor(Math.random() * (2 * f + 1)) - f;
}

/** rating: 1=もう一度 2=難しい 3=正解 4=簡単。新しい srs を返す（元は変更しない） */
export function schedule(srs, rating, now = Date.now()) {
  const s = { ...srs };
  s.reps = (s.reps || 0) + 1;

  if (s.state === 'new' || s.state === 'learning' || s.state === 'relearning') {
    const relearn = s.state === 'relearning';
    const steps = relearn ? RELEARN_STEPS : LEARN_STEPS;
    if (s.state === 'new') { s.state = 'learning'; s.step = 0; }

    if (rating === 1) {
      s.step = 0;
      s.due = now + steps[0] * MIN;
    } else if (rating === 2) {
      const cur = steps[s.step] || steps[steps.length - 1];
      const next = steps[s.step + 1] || cur * 1.5;
      s.due = now + Math.round((cur + next) / 2) * MIN;
    } else if (rating === 3) {
      if (s.step + 1 < steps.length) {
        s.step += 1;
        s.due = now + steps[s.step] * MIN;
      } else {
        s.ivl = relearn ? Math.max(1, s.ivl) : GRAD_IVL;
        s.state = 'review';
        s.step = 0;
        s.due = dueInDays(s.ivl, now);
      }
    } else {
      s.ivl = relearn ? Math.max(2, Math.round(s.ivl * 1.5)) : EASY_IVL;
      s.state = 'review';
      s.step = 0;
      s.due = dueInDays(s.ivl, now);
    }
    return s;
  }

  // review
  const elapsed = Math.max(0, (startOfDay(now) - (s.due - s.ivl * DAY)) / DAY);
  const base = Math.max(s.ivl, elapsed);
  if (rating === 1) {
    s.lapses = (s.lapses || 0) + 1;
    s.ease = Math.max(1.3, s.ease - 0.2);
    s.ivl = Math.max(1, Math.round(s.ivl * 0.5));
    s.state = 'relearning';
    s.step = 0;
    s.due = now + RELEARN_STEPS[0] * MIN;
  } else if (rating === 2) {
    s.ease = Math.max(1.3, s.ease - 0.15);
    s.ivl = Math.max(s.ivl + 1, Math.round(base * 1.2));
    s.due = dueInDays(fuzz(s.ivl), now);
  } else if (rating === 3) {
    s.ivl = Math.max(s.ivl + 1, Math.round(base * s.ease));
    s.due = dueInDays(fuzz(s.ivl), now);
  } else {
    s.ease = s.ease + 0.15;
    s.ivl = Math.max(s.ivl + 2, Math.round(base * s.ease * 1.3));
    s.due = dueInDays(fuzz(s.ivl), now);
  }
  return s;
}

/** ボタンに表示する「次は○○後」 */
export function previewLabel(srs, rating, now = Date.now()) {
  const next = schedule(srs, rating, now);
  const diff = next.due - now;
  if (diff < 60 * MIN) return `${Math.max(1, Math.round(diff / MIN))}分`;
  if (diff < DAY) return `${Math.round(diff / (60 * MIN))}時間`;
  const days = Math.max(1, Math.round(diff / DAY));
  if (days < 31) return `${days}日`;
  if (days < 365) return `${(days / 30).toFixed(1).replace(/\.0$/, '')}ヶ月`;
  return `${(days / 365).toFixed(1).replace(/\.0$/, '')}年`;
}

export function isDue(card, now = Date.now()) {
  const s = card.srs;
  if (!s || s.state === 'new') return false;
  if (s.state === 'review') return s.due < startOfDay(now) + DAY;
  return s.due <= now;
}
