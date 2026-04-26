-- Rename table
ALTER TABLE public.sms_template_overrides RENAME TO message_template_overrides;

-- Add channel + email-specific columns
ALTER TABLE public.message_template_overrides
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'sms',
  ADD COLUMN IF NOT EXISTS subject_fr text,
  ADD COLUMN IF NOT EXISTS subject_en text,
  ADD COLUMN IF NOT EXISTS html_fr text,
  ADD COLUMN IF NOT EXISTS html_en text;

ALTER TABLE public.message_template_overrides
  ADD CONSTRAINT message_template_overrides_channel_check
  CHECK (channel IN ('email','sms','whatsapp'));

-- Re-key on (channel, template_id)
ALTER TABLE public.message_template_overrides DROP CONSTRAINT IF EXISTS sms_template_overrides_pkey;
ALTER TABLE public.message_template_overrides ADD PRIMARY KEY (channel, template_id);

-- Add channel column to send logs
ALTER TABLE public.sms_send_logs
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'sms';

ALTER TABLE public.sms_send_logs
  ADD CONSTRAINT sms_send_logs_channel_check
  CHECK (channel IN ('sms','whatsapp'));