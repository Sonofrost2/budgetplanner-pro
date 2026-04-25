ALTER TABLE public.sms_send_logs
  ADD COLUMN IF NOT EXISTS status_queued_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_undelivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_status_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_sms_send_logs_twilio_sid ON public.sms_send_logs(twilio_sid);