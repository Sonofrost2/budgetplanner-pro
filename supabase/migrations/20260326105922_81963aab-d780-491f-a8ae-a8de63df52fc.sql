
-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to call notify-transaction edge function after INSERT
CREATE OR REPLACE FUNCTION public.notify_on_transaction_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  supabase_url text;
  service_key text;
BEGIN
  -- Get config from vault or use direct URL
  supabase_url := current_setting('app.settings.supabase_url', true);
  IF supabase_url IS NULL THEN
    supabase_url := 'https://sfcwoftgzxplbexcmzva.supabase.co';
  END IF;
  
  service_key := current_setting('app.settings.service_role_key', true);
  IF service_key IS NULL THEN
    -- Skip if no service key available
    RETURN NEW;
  END IF;

  -- Call edge function asynchronously via pg_net
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/notify-transaction',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'amount', NEW.amount,
      'type', NEW.type,
      'description', NEW.description,
      'account_id', NEW.account_id
    )
  );

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_notify_transaction ON public.transactions;
CREATE TRIGGER trg_notify_transaction
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_transaction_insert();
