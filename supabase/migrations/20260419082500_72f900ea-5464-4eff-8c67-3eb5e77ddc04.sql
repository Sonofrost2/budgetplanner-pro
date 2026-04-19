
CREATE OR REPLACE FUNCTION public.notify_family_on_large_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_name text;
  v_threshold numeric := 50000;
  v_member record;
  v_member_prefs record;
  v_current_hour int;
  v_in_quiet boolean;
  v_dedup text;
  v_title text;
  v_body text;
  v_supabase_url text := 'https://sfcwoftgzxplbexcmzva.supabase.co';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmY3dvZnRnenhwbGJleGNtenZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MjM5OTYsImV4cCI6MjA4ODQ5OTk5Nn0.PRMjJgY1JDygvq-r5QDAugGZed3eEvS_Ie9wD3B1_qE';
BEGIN
  IF NEW.deleted_at IS NOT NULL OR NEW.linked_transfer_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Use actor's own large_transaction_threshold as reference
  SELECT large_transaction_threshold INTO v_threshold
  FROM notification_preferences WHERE user_id = NEW.user_id;
  v_threshold := COALESCE(v_threshold, 50000);

  IF NEW.amount < v_threshold THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(display_name, 'Un membre') INTO v_actor_name
  FROM profiles WHERE user_id = NEW.user_id;

  v_title := CASE WHEN NEW.type='expense' THEN '👨‍👩‍👧 Dépense famille' ELSE '👨‍👩‍👧 Revenu famille' END;
  v_body := v_actor_name || ' • ' || NEW.description || ' • ' || to_char(NEW.amount, 'FM999G999G999') || ' FCFA';

  FOR v_member IN
    SELECT DISTINCT fm2.user_id
    FROM family_members fm1
    INNER JOIN family_members fm2 ON fm2.group_id = fm1.group_id AND fm2.user_id <> fm1.user_id
    WHERE fm1.user_id = NEW.user_id
  LOOP
    SELECT * INTO v_member_prefs FROM notification_preferences WHERE user_id = v_member.user_id;
    IF v_member_prefs IS NULL OR NOT v_member_prefs.large_transaction THEN CONTINUE; END IF;

    IF v_member_prefs.quiet_hours_enabled THEN
      v_current_hour := EXTRACT(HOUR FROM now() AT TIME ZONE 'UTC');
      IF v_member_prefs.quiet_hours_start > v_member_prefs.quiet_hours_end THEN
        v_in_quiet := v_current_hour >= v_member_prefs.quiet_hours_start OR v_current_hour < v_member_prefs.quiet_hours_end;
      ELSE
        v_in_quiet := v_current_hour >= v_member_prefs.quiet_hours_start AND v_current_hour < v_member_prefs.quiet_hours_end;
      END IF;
      IF v_in_quiet THEN CONTINUE; END IF;
    END IF;

    v_dedup := 'family_tx:' || NEW.id::text || ':' || v_member.user_id::text;

    BEGIN
      INSERT INTO notification_history (user_id, notification_type, channel, title, body, dedup_key, reference_id)
      VALUES (v_member.user_id, 'family_activity', 'push', v_title, v_body, v_dedup, NEW.id::text);
    EXCEPTION WHEN unique_violation THEN
      CONTINUE;
    END;

    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/push-notify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', v_anon,
        'Authorization', 'Bearer ' || v_anon
      ),
      body := jsonb_build_object(
        'user_id', v_member.user_id,
        'title', v_title,
        'body', v_body,
        'data', jsonb_build_object('url', '/dashboard/family')
      ),
      timeout_milliseconds := 30000
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_family_large_tx ON public.transactions;
CREATE TRIGGER trg_notify_family_large_tx
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.notify_family_on_large_transaction();

CREATE UNIQUE INDEX IF NOT EXISTS notification_history_dedup_uidx
ON public.notification_history (user_id, dedup_key)
WHERE dedup_key IS NOT NULL;
