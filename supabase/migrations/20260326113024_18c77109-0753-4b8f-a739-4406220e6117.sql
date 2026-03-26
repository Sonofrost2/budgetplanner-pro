-- Drop old trigger and function
DROP TRIGGER IF EXISTS trg_notify_transaction ON public.transactions;
DROP FUNCTION IF EXISTS public.notify_on_transaction_insert();

-- Recreate with direct push-notify call and 30s timeout
CREATE OR REPLACE FUNCTION public.notify_on_transaction_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prefs record;
  v_has_subs boolean;
  v_in_quiet boolean := false;
  v_current_hour int;
  v_notif jsonb;
  v_notifications jsonb[] := '{}';
  v_formatted_amount text;
  v_account_name text;
  v_balance numeric;
  v_total_income numeric;
  v_total_expense numeric;
  v_supabase_url text;
  v_service_key text;
BEGIN
  -- Get config
  v_supabase_url := 'https://sfcwoftgzxplbexcmzva.supabase.co';
  v_service_key := current_setting('supabase.service_role_key', true);

  -- 1. Check notification preferences
  SELECT * INTO v_prefs
  FROM notification_preferences
  WHERE user_id = NEW.user_id;
  
  IF v_prefs IS NULL THEN
    RETURN NEW;
  END IF;

  -- 2. Check quiet hours
  IF v_prefs.quiet_hours_enabled THEN
    v_current_hour := EXTRACT(HOUR FROM now() AT TIME ZONE 'UTC');
    IF v_prefs.quiet_hours_start > v_prefs.quiet_hours_end THEN
      v_in_quiet := v_current_hour >= v_prefs.quiet_hours_start OR v_current_hour < v_prefs.quiet_hours_end;
    ELSE
      v_in_quiet := v_current_hour >= v_prefs.quiet_hours_start AND v_current_hour < v_prefs.quiet_hours_end;
    END IF;
    IF v_in_quiet THEN
      RETURN NEW;
    END IF;
  END IF;

  -- 3. Check if user has push subscriptions
  SELECT EXISTS(
    SELECT 1 FROM push_subscriptions WHERE user_id = NEW.user_id LIMIT 1
  ) INTO v_has_subs;
  
  IF NOT v_has_subs THEN
    RETURN NEW;
  END IF;

  v_formatted_amount := to_char(NEW.amount, 'FM999G999G999');

  -- 4. Large transaction check
  IF v_prefs.large_transaction AND NEW.amount >= v_prefs.large_transaction_threshold THEN
    v_notifications := v_notifications || jsonb_build_object(
      'title', CASE WHEN NEW.type = 'expense' THEN '💸 Dépense importante' ELSE '💰 Revenu important' END,
      'body', NEW.description || ': ' || v_formatted_amount || ' FCFA'
    );
  END IF;

  -- 5. Low balance check (expenses with account only)
  IF v_prefs.low_balance AND NEW.type = 'expense' AND NEW.account_id IS NOT NULL THEN
    SELECT name INTO v_account_name
    FROM payment_accounts WHERE id = NEW.account_id;
    
    IF v_account_name IS NOT NULL THEN
      SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0),
             COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)
      INTO v_total_income, v_total_expense
      FROM transactions
      WHERE account_id = NEW.account_id AND user_id = NEW.user_id;

      SELECT opening_balance + v_total_income - v_total_expense
      INTO v_balance
      FROM payment_accounts WHERE id = NEW.account_id;

      IF v_balance <= v_prefs.low_balance_threshold THEN
        v_notifications := v_notifications || jsonb_build_object(
          'title', '⚠️ Solde bas sur ' || v_account_name,
          'body', 'Solde: ' || to_char(v_balance, 'FM999G999G999') || ' FCFA (seuil: ' || to_char(v_prefs.low_balance_threshold, 'FM999G999G999') || ' FCFA)'
        );
      END IF;
    END IF;
  END IF;

  -- 6. Send each notification via push-notify with 30s timeout
  FOREACH v_notif IN ARRAY v_notifications
  LOOP
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/push-notify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmY3dvZnRnenhwbGJleGNtenZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MjM5OTYsImV4cCI6MjA4ODQ5OTk5Nn0.PRMjJgY1JDygvq-r5QDAugGZed3eEvS_Ie9wD3B1_qE',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmY3dvZnRnenhwbGJleGNtenZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MjM5OTYsImV4cCI6MjA4ODQ5OTk5Nn0.PRMjJgY1JDygvq-r5QDAugGZed3eEvS_Ie9wD3B1_qE'
      ),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'title', v_notif->>'title',
        'body', v_notif->>'body',
        'data', jsonb_build_object('url', '/dashboard/transactions')
      ),
      timeout_milliseconds := 30000
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_transaction
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_transaction_insert();