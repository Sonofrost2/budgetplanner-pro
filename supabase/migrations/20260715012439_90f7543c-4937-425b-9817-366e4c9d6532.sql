ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS savings_deadline_alerts boolean NOT NULL DEFAULT true;