CREATE TABLE public.sms_send_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by uuid,
  recipient text NOT NULL,
  template_id text,
  body text NOT NULL,
  twilio_sid text,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sms_send_logs_created_at ON public.sms_send_logs (created_at DESC);
CREATE INDEX idx_sms_send_logs_sent_by ON public.sms_send_logs (sent_by);

ALTER TABLE public.sms_send_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read sms logs"
ON public.sms_send_logs FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete sms logs"
ON public.sms_send_logs FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Block direct client writes; only service role (edge functions) can insert
CREATE POLICY "Deny client inserts on sms_send_logs"
ON public.sms_send_logs FOR INSERT TO authenticated
WITH CHECK (false);

CREATE POLICY "Deny client updates on sms_send_logs"
ON public.sms_send_logs FOR UPDATE TO authenticated
USING (false);