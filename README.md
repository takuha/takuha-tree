# TIM

予定カレンダーの PWA。旧称 TAKUHA tree → árbol → TIM（現行名）。2026-09-16に大阪(日本)在住を前提とした日本語オンリー・コンパクトなUIへ全面整理済み。

- 月カレンダー／1日の時間割／今後の予定（Feed）
- 期間予定は日をまたぐ帯で表示（**追加・編集も画面からできる**）
- 予定カテゴリは6種類のみ：🤝アポ（赤）／💰ビジネス／💼仕事／🎉遊び／🍴ごはん／🆓フリー
- 各行を ✓ で完了にでき、その記録をもとに **改善スタジオ** が偏りと次の一手を出す
- 🔊 その日の予定を読み上げ（Web Speech API・iPhone Safariでも動く）
- 🎙️ 音声で予定追加（Siriショートカット→GitHub Actions、要セットアップ・下記参照）
- 🔔 アポの30分前にスマホへ通知（cron + ntfy、TAKUHAさんのMac側で常時稼働）
- ライト／ダーク自動切替＋アクセント色6種
- オフラインで開ける（Service Worker）
- データは**端末のローカル保存のみ**（サーバーに送信しません）。書出／読込で移行できます。

## ファイル

| ファイル | 役割 |
| --- | --- |
| `index.html` | 本体。月・日・今後の予定・ツールの4画面 |
| `studio/index.html` | 改善スタジオ。分析／見た目／台本の3タブ |
| `app-core.js` | 日付・カテゴリ・**いつもの時間割**・保存データ。本体とスタジオで共有 |
| `theme.css` | 配色と土台のスタイル。色を変えるならここ |
| `sw.js` | オフライン用。HTMLは network-first、CSS/JSは stale-while-revalidate |
| `scripts/add_schedule.py` | 音声予定追加（Siriショートカット経由）を処理するGitHub Actionsスクリプト |

**いつもの時間割を変えたいときは `app-core.js` の `timeline()` だけ直せばよい。**
本体とスタジオの両方に同時に効く。

## 改善スタジオ（`studio/`）

本体と同じ保存データを読む。ツール画面のリンクか `studio/` を直接開く。

- **📈 分析** — 7/14/30日ぶんの消化率、種類ごと・曜日ごとの偏り、発信の連続日数。そこから改善案を出す。完了チェックが1つもないうちは案内だけ出る。
- **🎨 見た目** — 明るさ（自動/ライト/ダーク）とアクセント色。選ぶとその場で本体にも効く。
- **✍️ 台本** — その日の時間割からリールのフック・構成・キャプション（日本語／スペイン語）・ハッシュタグの下書きを作る。**アポのお客さん名は公開文面に出さない。** 出す前に自分の言葉に直すこと。定型生成と AI 生成の2通り（次項）。

### AI で書く（任意）

Anthropic の API キーを入れると、台本タブの「✨ AIで書く」が使えるようになる。
キーが無いときは定型生成だけが動く（今までどおり）。

- モデルは `claude-opus-5`、`effort: medium`、構造化出力で項目を固定。
  変えるなら `studio/index.html` の `MODEL` と `output_config`。
- **キーは `localStorage` の `takuha_tree_api_key` に、予定データとは別に保存する。**
  同じ場所に入れると書き出しファイルに混ざり、バックアップを渡した相手に
  キーごと渡ることになるため。
- 送るのは**その日の時間割とメモだけ**。アポは本数だけ送り、お客さんの名前は送らない。
- ブラウザから直接 API を叩くので `anthropic-dangerous-direct-browser-access: true`
  が要る。裏返すと**キーが端末のブラウザに置かれる**ということなので、端末を他人が
  触れる状況では抜き取られる。使わない期間は画面の「削除」で消しておく。
  それが困るなら、キーを持つ小さなプロキシを挟む形に変えるしかない。

## 音声で予定追加（Siriショートカット）— 要セットアップ

iPhoneで「予定追加」と話しかけると、Siriショートカット→GitHub Actions
（`.github/workflows/add-schedule.yml` → `scripts/add_schedule.py`）が
発話テキストをClaude APIで解析し、`sync.json`に追記してpushする。
数十秒後にntfy（トピック`takuha-aichan-3fcb886f2fa7`）で結果が届く。

⚠️ **2026-09-28時点で未セットアップ**（`ANTHROPIC_API_KEY`のリポジトリシークレット未登録・実行すると401 Unauthorizedで失敗する）。以下はTAKUHAさん本人がGitHub/Shortcuts側で行う必要がある（APIキー・PATの発行やiPhone実機操作はAIちゃん側からはできない）。

セットアップ（初回のみ）:

1. **GitHub Actions シークレット**: リポジトリの Settings → Secrets and
   variables → Actions → New repository secret で `ANTHROPIC_API_KEY` を追加
   （console.anthropic.com のAPIキー。改善スタジオのブラウザ用キーとは別管理）。
2. **PAT（このiPhone専用）**: GitHub → Settings → Developer settings →
   Personal access tokens → Fine-grained tokens で新規作成。
   Repository access は `takuha-tree` のみ、Permissions は
   `Contents: Read and write` を付与。
3. **iPhone Shortcuts アプリ**で新規ショートカット「予定追加」を作成:
   - `Dictate Text`（言語: 日本語）
   - `Get Contents of URL`:
     - URL: `https://api.github.com/repos/takuha/takuha-tree/dispatches`
     - Method: POST
     - Headers: `Authorization: Bearer <PAT>` / `Accept: application/vnd.github+json`
     - Request Body (JSON): `event_type` = `add_schedule`、
       `client_payload` = 辞書 `{ text: <Dictated Text>, now: <現在日時ISO8601> }`
   - Siriフレーズ「予定追加」を割り当て

TAKUHAさんは現在日本在住のため、`gt`（時刻）は日本の実時刻をそのまま使う（時差変換なし）。カテゴリは6種類のキーからClaudeが内容で推定、不明なら`free`。

## データの形

キー `takuha_sched_v1`。旧バージョンのデータはそのまま開ける。

```jsonc
{
  "appts":  {},  // 廃止済み機能の名残(未使用)
  "events": { "2026-09-28": [ { "id": 1, "title": "…", "gt": 540, "dur": 60, "cat": "work" } ] },
  "ranges": [ { "id": 2, "start": "2026-09-21", "end": "2026-09-22", "title": "…", "cat": "play" } ],
  "done":   { "2026-09-28": { "r540": 1, "e1": 1 } },                 // 完了チェック
  "prefs":  { "theme": "auto", "accent": "tree", "showRoutine": true }
}
```

`gt` は日本時間の 0:00 からの分（時差変換なし・実時刻そのまま）。
`done` のキーは いつもの予定=`r`+開始分 / 追加した予定=`e`+id。

## 開発

ビルドなし。ローカルで見るときだけ、Service Worker のために http で開く。

```sh
python3 -m http.server 8765   # → http://localhost:8765/
```

`sw.js` を変えたら `VERSION` を上げる。古いキャッシュは次回 activate 時に消える。
