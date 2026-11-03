-- =============================================================================
-- LINE AI Bot — データベーススキーマ
-- 対象: Supabase (PostgreSQL)
-- 適用方法: Supabase ダッシュボード > SQL Editor に貼り付けて実行
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. faq（よくある質問）
--    ユーザーからの定型質問に対する回答をあらかじめ登録しておくテーブル
-- -----------------------------------------------------------------------------
create table if not exists faq (
  id          uuid        primary key default gen_random_uuid(),
  question    text        not null,                   -- 質問文
  answer      text        not null,                   -- 回答文
  is_active   boolean     not null default true,      -- false にすると AI が参照しない
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- updated_at を自動更新するトリガー関数（共通）
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger faq_set_updated_at
  before update on faq
  for each row execute function set_updated_at();

-- RLS を有効化（有効化しただけではポリシーが存在しないためすべてのアクセスを拒否）
alter table faq enable row level security;


-- -----------------------------------------------------------------------------
-- 2. menus（メニュー情報）
--    店舗のメニュー・価格を管理するテーブル
-- -----------------------------------------------------------------------------
create table if not exists menus (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,                   -- メニュー名
  description text        not null default '',        -- 説明文（省略可）
  price       integer     not null check (price >= 0),-- 価格（円）。0 は無料を意味する
  is_active   boolean     not null default true,      -- false にすると表示・参照しない
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger menus_set_updated_at
  before update on menus
  for each row execute function set_updated_at();

alter table menus enable row level security;


-- -----------------------------------------------------------------------------
-- 3. conversations（会話履歴）
--    LINE ユーザーとボットのやり取りをすべて記録するテーブル
-- -----------------------------------------------------------------------------
create table if not exists conversations (
  id             uuid        primary key default gen_random_uuid(),
  line_user_id   text        not null,                -- LINE ユーザー ID（Uxxxxxxxx 形式）
  user_message   text        not null,                -- ユーザーの発言
  bot_response   text        not null,                -- ボットの返答
  needs_human    boolean     not null default false,  -- true のとき有人対応フラグが立つ
  created_at     timestamptz not null default now()
  -- 会話履歴は変更しないため updated_at は不要
);

-- LINE ユーザーごとの履歴検索を高速化するインデックス
create index if not exists conversations_line_user_id_idx
  on conversations (line_user_id, created_at desc);

alter table conversations enable row level security;


-- =============================================================================
-- RLS ポリシー
-- ポリシーを一切定義しないことで、anon / authenticated ロールからの直接アクセスを遮断。
-- サーバーサイドからは service_role キーを使用することで RLS をバイパスしてアクセスする。
--
-- 将来的に管理画面など認証済みユーザーへのアクセスを許可する場合は
-- 以下のコメントを外してポリシーを追加する。
-- =============================================================================

-- -- 管理者ロール（authenticated）に全操作を許可する場合の例:
-- create policy "管理者は faq を操作できる"
--   on faq for all
--   to authenticated
--   using (true)
--   with check (true);
--
-- create policy "管理者は menus を操作できる"
--   on menus for all
--   to authenticated
--   using (true)
--   with check (true);
--
-- create policy "管理者は conversations を参照できる"
--   on conversations for select
--   to authenticated
--   using (true);
