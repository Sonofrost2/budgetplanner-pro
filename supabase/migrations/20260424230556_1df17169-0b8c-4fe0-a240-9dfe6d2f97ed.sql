ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text;

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS notify_via_sms boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_via_whatsapp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_payment_receipts boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_subscription_expiry boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_payment_failure boolean NOT NULL DEFAULT true;