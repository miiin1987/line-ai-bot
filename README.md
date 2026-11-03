# LINE AI Bot

LINE Messaging API と Claude API を連携させた AI チャットボット。

## 技術スタック

- **Next.js 16** (App Router)
- **TypeScript 5**
- **Tailwind CSS 4**
- **Supabase** (PostgreSQL)
- **LINE Messaging API**
- **Claude API** (Anthropic)

## 実装済み機能

### LINE Webhook (`POST /api/webhook`)

- LINE からのメッセージを受信するエンドポイント
- `x-line-signature` ヘッダーによる署名検証（必須）
- テキストメッセージをそのまま返信する Echo Bot
- テキスト以外のメッセージは無視

### データベーススキーマ (`supabase/schema.sql`)

Supabase (PostgreSQL) 用のテーブル定義。未適用。

| テーブル | 用途 |
|---------|------|
| `faq` | よくある質問と回答 |
| `menus` | メニュー情報・価格 |
| `conversations` | LINE ユーザーとの会話履歴 |

すべてのテーブルで RLS（行レベルセキュリティ）を有効化済み。
サーバーサイドは `service_role` キー経由でアクセスする。

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local.example` をコピーして `.env.local` を作成し、各値を設定する。

```bash
cp .env.local.example .env.local
```

| 変数名 | 取得元 |
|--------|--------|
| `LINE_CHANNEL_SECRET` | LINE Developers コンソール |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers コンソール |
| `ANTHROPIC_API_KEY` | Anthropic Console |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase ダッシュボード |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase ダッシュボード |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase ダッシュボード |

### 3. データベースの初期化

Supabase ダッシュボードの SQL Editor で `supabase/schema.sql` を実行する。

### 4. 開発サーバーの起動

```bash
npm run dev
```

### 5. LINE Webhook URL の設定

ngrok などでローカルを公開し、LINE Developers コンソールの Webhook URL に設定する。

```
https://<your-domain>/api/webhook
```

## スクリプト

```bash
npm run dev      # 開発サーバー起動
npm run build    # プロダクションビルド（webpack）
npm run lint     # ESLint 実行
```

## 注意事項

- `.env.local` は絶対にコミットしない
- `SUPABASE_SERVICE_ROLE_KEY` はサーバーサイドのみで使用する
- LINE Webhook の署名検証は必須（無効化禁止）
