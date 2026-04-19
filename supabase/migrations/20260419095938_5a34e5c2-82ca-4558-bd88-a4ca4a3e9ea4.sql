
-- Add new notification preference columns for cadence, digest, capture reminder, daily cap
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS morning_digest_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS morning_digest_hour integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS evening_capture_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS evening_capture_hour integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS status_reminder_frequency text NOT NULL DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS max_push_per_day integer NOT NULL DEFAULT 3;

-- Validation triggers (replace CHECK to keep them mutable-friendly)
CREATE OR REPLACE FUNCTION public.validate_notification_preferences()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.morning_digest_hour < 5 OR NEW.morning_digest_hour > 11 THEN
    RAISE EXCEPTION 'morning_digest_hour must be between 5 and 11';
  END IF;
  IF NEW.evening_capture_hour < 17 OR NEW.evening_capture_hour > 22 THEN
    RAISE EXCEPTION 'evening_capture_hour must be between 17 and 22';
  END IF;
  IF NEW.status_reminder_frequency NOT IN ('weekly','every_3d','on_change_only') THEN
    RAISE EXCEPTION 'status_reminder_frequency must be weekly, every_3d or on_change_only';
  END IF;
  IF NEW.max_push_per_day < 1 OR NEW.max_push_per_day > 10 THEN
    RAISE EXCEPTION 'max_push_per_day must be between 1 and 10';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_notification_preferences_trigger ON public.notification_preferences;
CREATE TRIGGER validate_notification_preferences_trigger
BEFORE INSERT OR UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.validate_notification_preferences();
