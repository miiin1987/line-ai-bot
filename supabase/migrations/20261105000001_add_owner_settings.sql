-- =============================================================================
-- Migration: owner_settings テーブルの追加
-- 目的: LINE 経由のオーナー登録フローで取得したユーザー ID を保存する
-- 適用: Supabase ダッシュボード > SQL Editor に貼り付けて実行
-- =============================================================================

-- id = 1 の単一行のみ許可するテーブル
-- upsert (ON CONFLICT (id) DO UPDATE) で上書き登録できる
create table if not exists owner_settings (
  id              integer     primary key default 1,
  line_user_id    text        not null,
  registered_at   timestamptz not null default now(),
  constraint owner_settings_single_row check (id = 1)
);

-- RLS を有効化（anon / authenticated からの直接アクセスをブロック）
-- サーバーサイドは service_role キーで RLS をバイパスしてアクセスする
alter table owner_settings enable row level security;

-- ロールバック用（適用を取り消す場合）:
-- drop table if exists owner_settings;
