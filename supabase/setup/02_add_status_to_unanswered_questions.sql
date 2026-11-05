-- 未回答質問テーブルに対応状況カラムを追加する
-- Supabase ダッシュボード > SQL Editor で実行すること
-- ※ カラムがすでに存在する場合はスキップされる

ALTER TABLE unanswered_questions
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT '未対応'
  CONSTRAINT unanswered_questions_status_check
    CHECK (status IN ('未対応', '対応済み', '対応不要'));

-- 実行確認用（任意）
-- SELECT id, question, status FROM unanswered_questions LIMIT 5;
