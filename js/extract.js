// 写真（教材の表）から単語帳カードを作る
import { settings } from './store.js';

// @anthropic-ai/sdk@1.4.0 を esbuild でブラウザ用に1ファイルにまとめたもの
const SDK_URL = './vendor/anthropic-sdk.js';

export const CARD_SCHEMA = {
  type: 'object',
  properties: {
    deckName: { type: 'string', description: '表の見出しから付けた単語帳の名前' },
    cards: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['grammar', 'vocab'] },
          front: { type: 'string' },
          back: { type: 'string' },
          category: { type: 'string' },
          note: { type: 'string' },
          examples: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                ko: { type: 'string' },
                ja: { type: 'string' },
                target: { type: 'string' },
                advanced: { type: 'boolean' },
              },
              required: ['ko', 'ja', 'target', 'advanced'],
              additionalProperties: false,
            },
          },
        },
        required: ['type', 'front', 'back', 'category', 'note', 'examples'],
        additionalProperties: false,
      },
    },
  },
  required: ['deckName', 'cards'],
  additionalProperties: false,
};

export function buildPrompt(extra = settings().extraRules) {
  return `あなたはTOPIK（韓国語能力試験）対策の単語帳を作るアシスタントです。
添付した写真は日本語で書かれたTOPIK教材のページです。ページ内の「表」から学習に必要な部分だけを取り出し、単語帳カードにしてください。

## 表の種類と変換ルール
1. 文法表（番号・文法パターン・日本語の機能名・例文が並ぶもの）
   - type: "grammar"
   - front: 文法パターンを書かれている通りに（例: "-(으)ㄴ/는데", "-(으)ㄹ까 봐(서)"）
   - back: 日本語の意味・機能名。①②があれば残して1行に（例: "①相反：対照 ②説明：導入"）
   - examples: 例文ごとに { ko: 韓国語の例文, ja: その日本語訳, target: 例文中で下線・太字になっている部分を例文の表記そのままで, advanced: 赤字など「上級」と示された例文なら true }
   - 1つの日本語訳に対して韓国語の言い換え文が複数並ぶ場合は、言い換え文それぞれを別の例文にし、ja には同じ訳を入れる。日本語訳が「／」で言い換えごとに分かれていれば、対応する部分を使って自然な1文にする
   - 言い換えに使われている別の文法は note に「似た表現：…」としてまとめる
2. 単語・キーワード表（テーマ名と「韓国語 日本語、韓国語 日本語…」が並ぶもの）
   - 韓国語と日本語の組ごとに1枚: type: "vocab", front: 韓国語, back: 日本語, category: その行のテーマ名（例: "時計"）, examples: []
3. それ以外の書き方の表
   - 韓国語↔日本語で覚える価値のある組を見つけて、上の1か2の形に合わせる

## 共通ルール
- category には表の見出し（例: "連結の表現"）か行のテーマ名を入れる。なければ空文字
- ページ番号・ランキング見出し・欄外の解説文・ロゴは無視する
- 写真に書かれていない情報を作らない。読めない部分は飛ばす
- deckName は表の見出しから短く付ける（例: "連結の表現 Top30"）
- 韓国語はハングルを正確に。分かち書き（スペース）も写真の通りに
${extra && extra.trim() ? `\n## 追加ルール（ユーザー指定・優先）\n${extra.trim()}\n` : ''}`;
}

export function buildChatPrompt() {
  return (
    buildPrompt() +
    `
## 出力形式
次の形の JSON だけを、コードブロック1つで出力してください。説明文は不要です。
{"deckName":"...","cards":[{"type":"grammar","front":"...","back":"...","category":"...","note":"...","examples":[{"ko":"...","ja":"...","target":"...","advanced":false}]}]}`
  );
}

/** 画像を長辺 maxSide px の JPEG に縮小して base64 を返す */
export async function resizeImage(file, maxSide = 1800) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('画像を読み込めませんでした'));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    return { dataUrl, base64: dataUrl.split(',')[1], width: w, height: h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

let sdkPromise = null;
function loadSdk() {
  sdkPromise = sdkPromise || import(/* @vite-ignore */ SDK_URL).then((m) => m.default || m.Anthropic);
  return sdkPromise;
}

/** Claude API で写真からカードを抽出 */
export async function extractWithClaude(images, { signal } = {}) {
  const { apiKey, model } = settings();
  if (!apiKey) throw new Error('設定で Claude API キーを入力してください');
  const Anthropic = await loadSdk();
  // 個人用アプリ：キーはこの端末にのみ保存され、Anthropic へ直接送られる
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  const content = [
    ...images.map((im) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: im.base64 } })),
    { type: 'text', text: buildPrompt() },
  ];

  let response;
  try {
    response = await client.beta.messages.create(
      {
        model: model || 'claude-opus-5-5',
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: {
          effort: 'medium',
          format: { type: 'json_schema', schema: CARD_SCHEMA },
        },
        messages: [{ role: 'user', content }],
      },
      { signal },
    );
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('API キーが正しくありません');
    if (e instanceof Anthropic.PermissionDeniedError) throw new Error('この API キーではこのモデルを使えません');
    if (e instanceof Anthropic.RateLimitError) throw new Error('混み合っています。少し待ってからもう一度お試しください');
    if (e instanceof Anthropic.APIConnectionError) throw new Error('通信できませんでした。ネット接続を確認してください');
    if (e instanceof Anthropic.APIError) throw new Error(`API エラー (${e.status ?? ''}): ${e.message}`);
    throw e;
  }

  if (response.stop_reason === 'refusal') throw new Error('この画像は処理できませんでした');
  if (response.stop_reason === 'max_tokens') throw new Error('出力が長すぎて途中で切れました。写真の枚数を減らしてお試しください');
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const data = parseCardsJson(text);
  return { ...data, usage: response.usage };
}

/** Claude アプリ等から貼り付けた文字列（JSON / コードブロック）を読む */
export function parseCardsJson(text) {
  let t = String(text || '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const start = t.search(/[[{]/);
  if (start > 0) t = t.slice(start);
  let data;
  try {
    data = JSON.parse(t);
  } catch {
    throw new Error('JSON として読み取れませんでした。出力をそのまま全部貼り付けてください');
  }
  if (Array.isArray(data)) data = { deckName: '', cards: data };
  if (!Array.isArray(data.cards)) throw new Error('cards が見つかりません');
  return { deckName: data.deckName || '', cards: data.cards };
}

/** CSV / TSV（Anki・Quizlet の書き出し）を読む。列: 表, 裏, [カテゴリ], [例文], [例文訳] */
export function parseDelimited(text) {
  const lines = String(text || '').split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const tabbed = lines.some((l) => l.includes('\t'));
  const rows = lines.map((l) => (tabbed ? l.split('\t') : splitCsv(l)));
  return rows
    .filter((r) => r[0] && r[1])
    .map((r) => ({
      type: 'vocab',
      front: r[0].trim(),
      back: r[1].trim(),
      category: (r[2] || '').trim(),
      note: '',
      examples: r[3] ? [{ ko: r[3].trim(), ja: (r[4] || '').trim(), target: '', advanced: false }] : [],
    }));
}

function splitCsv(line) {
  const out = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
