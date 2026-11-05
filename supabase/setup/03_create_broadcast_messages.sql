CREATE TABLE IF NOT EXISTS broadcast_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CONSTRAINT broadcast_messages_status_check
    CHECK (status IN ('pending', 'sent', 'failed', 'unknown')),
  error_detail text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  created_by text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_pending_broadcast
ON broadcast_messages ((status))
WHERE status = 'pending';

ALTER TABLE broadcast_messages
ENABLE ROW LEVEL SECURITY;