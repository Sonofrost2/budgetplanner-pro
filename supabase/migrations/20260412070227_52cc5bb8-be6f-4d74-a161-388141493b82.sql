
-- Notification history table
CREATE TABLE public.notification_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  channel text NOT NULL DEFAULT 'push',
  notification_type text NOT NULL,
  title text NOT NULL,
  body text,
  reference_id text,
  dedup_key text,
  sent_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint to prevent duplicate sends
CREATE UNIQUE INDEX idx_notification_history_dedup 
  ON public.notification_history (user_id, dedup_key) 
  WHERE dedup_key IS NOT NULL;

-- Index for querying user history
CREATE INDEX idx_notification_history_user 
  ON public.notification_history (user_id, sent_at DESC);

-- Enable RLS
ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;

-- Users can read their own notification history
CREATE POLICY "Users can read own notifications"
  ON public.notification_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Only service role can insert (no authenticated insert policy)
