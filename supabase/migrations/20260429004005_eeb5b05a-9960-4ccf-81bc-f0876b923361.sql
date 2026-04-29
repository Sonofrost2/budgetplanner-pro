ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS factual_delivery_mode text NOT NULL DEFAULT 'immediate',
  ADD COLUMN IF NOT EXISTS reminder_delivery_mode text NOT NULL DEFAULT 'morning';

CREATE OR REPLACE FUNCTION public.validate_notification_delivery_modes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.factual_delivery_mode NOT IN ('immediate','morning','evening') THEN
    RAISE EXCEPTION 'invalid factual_delivery_mode: %', NEW.factual_delivery_mode;
  END IF;
  IF NEW.reminder_delivery_mode NOT IN ('immediate','morning','evening','both') THEN
    RAISE EXCEPTION 'invalid reminder_delivery_mode: %', NEW.reminder_delivery_mode;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_delivery_modes ON public.notification_preferences;
CREATE TRIGGER trg_validate_delivery_modes
  BEFORE INSERT OR UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.validate_notification_delivery_modes();

COMMENT ON COLUMN public.notification_preferences.factual_delivery_mode IS
  'How to deliver factual/event-driven notifications: immediate | morning | evening';
COMMENT ON COLUMN public.notification_preferences.reminder_delivery_mode IS
  'How to deliver periodic reminder notifications: immediate | morning | evening | both';