# LINE AI Bot — プロジェクトガイド

## プロジェクト概要

LINE Messaging API と Claude API を組み合わせた AI チャットボット。
Next.js App Router をベースに構築し、Supabase で会話履歴を管理する。

## 技術スタック

| 分類 | 技術 |
|------|------|
| フレームワーク | Next.js 16 (App Router) |
| 言語 | TypeScript 5 |
| スタイリング | Tailwind CSS 4 |
| データベース | Supabase (PostgreSQL) |
| メッセージング | LINE Messaging API |
| AI | Claude API (Anthropic) |
| ランタイム | Node.js (Fluid Compute) |

## ディレクトリ構成

```
src/
  app/
    api/
      webhook/        # LINE Webhook エンドポイント
        route.ts
    (admin)/          # 管理画面（任意）
  components/         # 再利用可能な UI コンポーネント
  lib/
    line/             # LINE API クライアント・署名検証
    claude/           # Claude API クライアント
    supabase/         # Supabase クライアント
  types/              # 型定義
```

## 開発コマンド

```bash
npm run dev      # 開発サーバー起動 (http://localhost:3000)
npm run build    # プロダクションビルド
npm run lint     # ESLint 実行
```

## 環境変数

`.env.local` に以下を定義する。本番環境は Vercel の Environment Variables で管理。

```env
# LINE
LINE_CHANNEL_SECRET=           # 署名検証に使用
LINE_CHANNEL_ACCESS_TOKEN=     # メッセージ送信に使用

# Claude API
ANTHROPIC_API_KEY=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=     # サーバーサイドのみ使用
```

**絶対に `.env.local` をコミットしない。** `.gitignore` に含まれていることを必ず確認すること。

## 開発ルール

### TypeScript
- `any` 型の使用を禁止。不明な型は `unknown` を使い、型ガードで絞り込む。
- 外部 API レスポンスには必ず型定義を作成する（`src/types/` に配置）。
- `strict: true` を維持する。

### コンポーネント
- Server Components をデフォルトとし、インタラクションが必要な場合のみ `"use client"` を付与する。
- コンポーネントは単一責任で再利用可能な粒度に保つ。
- Props には必ず TypeScript の型を定義する。

### LINE Webhook
- **すべての Webhook リクエストで署名検証を必須とする。**
  検証失敗時は即座に `401` を返す。
- Webhook エンドポイントは `POST /api/webhook` に統一する。
- LINE の仕様上、200 レスポンスを素早く返す必要があるため、重い処理は非同期で行う。

```typescript
// 署名検証の基本パターン
import { validateSignature } from "@line/bot-sdk";

const isValid = validateSignature(
  rawBody,
  process.env.LINE_CHANNEL_SECRET!,
  signature
);
if (!isValid) return new Response("Unauthorized", { status: 401 });
```

### エラー処理
- すべての外部 API 呼び出し（LINE / Claude / Supabase）は `try/catch` で囲む。
- エラーログは `console.error` を使い、エラーオブジェクトを必ず含める。
- ユーザーへのエラーメッセージは日本語で、技術的詳細は含めない。

```typescript
try {
  // 外部 API 呼び出し
} catch (error) {
  console.error("[LINE Webhook] メッセージ送信失敗:", error);
  // LINE ユーザーへのフォールバックメッセージを送信
}
```

### UI / スタイリング
- **カラーパレット:** 白ベース、緑をアクセントカラー（Tailwind の `green-500` / `green-600` を基準）。
- **レスポンシブ:** モバイルファースト。`sm:` / `md:` ブレークポイントを適切に使用する。
- Tailwind のユーティリティクラスを直接使用し、CSS ファイルへの追記は最小限にする。

### 言語・コメント
- コメントと変数名以外のドキュメント文字列は**日本語**で書く。
- 変数名・関数名・型名は英語のキャメルケース / パスカルケースを使用する。
- コメントは「何をしているか」ではなく「なぜそうしているか」を書く。

## セキュリティ要件

1. LINE Webhook 署名検証を必ず実施する（前述）。
2. `SUPABASE_SERVICE_ROLE_KEY` はサーバーサイドのみで使用し、クライアントに露出させない。
3. `NEXT_PUBLIC_` プレフィックスの環境変数はクライアントに公開されることを意識する。
4. ユーザー入力をそのまま SQL や外部 API に渡さない。Supabase クライアントのパラメータバインディングを使用する。
5. Claude API へ送るプロンプトにはシステムプロンプトを設定し、不適切な操作を防ぐ。

## よくある作業パターン

### LINE からのメッセージを受け取り Claude に問い合わせて返信する

1. `POST /api/webhook` で署名検証
2. イベント種別を確認（`message` / `follow` / `unfollow` など）
3. `TextMessage` イベントのテキストを取得
4. Supabase から該当ユーザーの会話履歴を取得
5. Claude API に履歴 + 新規メッセージを送信
6. Claude の応答を LINE Reply API で返信
7. 会話履歴を Supabase に保存

### Supabase テーブル設計（想定）

```sql
-- 会話履歴
create table conversations (
  id uuid primary key default gen_random_uuid(),
  line_user_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);
```
