# TOPIK 単語帳

Anki・Quizlet の代わりに使える、無料の TOPIK 対策単語帳アプリ（スマホ向け PWA）。

- **間隔反復（Anki 風）**：もう一度／難しい／正解／簡単 の4段階で、次に出す日を自動で決めます
- **4択クイズ・穴埋め・入力・マッチング**（Quizlet 風）
- **写真から単語帳を作成**：教材の表を撮ると、文法・例文・単語を読み取ってカードにします
  - Claude API キーがあれば自動で読み取り
  - キーがなくても、Claude アプリに指示文と写真を送り、返ってきた JSON を貼り付ければ取り込めます
- 韓国語の読み上げ、ダークモード、オフライン対応
- CSV（Anki・Quizlet の書き出し）の取り込み、バックアップ・復元
- データはすべて端末内（ブラウザ）に保存。サーバー不要・無料

## 使い方（スマホ）

1. GitHub Pages で公開した URL を Chrome（または Samsung Internet）で開く
2. メニューの「ホーム画面に追加」でアプリとして使える

## ファイル構成

| ファイル | 内容 |
|---|---|
| `index.html` / `css/style.css` | 画面 |
| `js/app.js` | 画面遷移・学習モード |
| `js/srs.js` | 間隔反復のスケジュール計算 |
| `js/store.js` | データ保存（localStorage） |
| `js/extract.js` | 写真 → カード変換（指示文・Claude API 呼び出し） |
| `js/seed.js` | 最初から入っているサンプル単語帳 |
| `js/vendor/anthropic-sdk.js` | `@anthropic-ai/sdk@1.4.0` をブラウザ用にまとめたもの |
| `sw.js` | オフライン用キャッシュ（更新時は `VERSION` を上げる） |

ローカルで試す: `python3 -m http.server` → http://localhost:8000
