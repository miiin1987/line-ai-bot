-- =============================================================================
-- Migration: unanswered_questions テーブルの追加
-- 目的: FAQ完全一致・AI回答のいずれにも該当しなかった質問を記録する
-- 適用: Supabase ダッシュボード > SQL Editor に貼り付けて実行
-- =============================================================================

create table if not exists unanswered_questions (
  id              uuid        primary key default gen_random_uuid(),
  line_event_id   text        not null unique,    -- LINE webhook イベント ID（再送重複防止）
  line_user_id    text,                           -- LINE ユーザー ID（null の場合あり）
  question        text        not null,           -- ユーザーの質問内容
  status          text        not null default '未対応'
                              check (status in ('未対応', '対応済み', '対応不要')),
  received_at     timestamptz not null,           -- LINE イベントのタイムスタンプ
  created_at      timestamptz not null default now()
);

-- 未対応の質問を受信日時降順で一覧取得するためのインデックス
create index if not exists unanswered_questions_status_received_idx
  on unanswered_questions (status, received_at desc);

-- RLS を有効化（anon / authenticated からの直接アクセスをブロック）
-- サーバーサイドは service_role キーで RLS をバイパスしてアクセスする
alter table unanswered_questions enable row level security;

-- ロールバック用（適用を取り消す場合）:
-- drop table if exists unanswered_questions;
