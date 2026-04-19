
ALTER TABLE public.family_groups
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'XOF',
  ADD COLUMN IF NOT EXISTS large_tx_threshold numeric NOT NULL DEFAULT 100000;

-- Allow admins (not just owner) to update groups
DROP POLICY IF EXISTS "Owners can update groups" ON public.family_groups;
CREATE POLICY "Owners and admins can update groups"
ON public.family_groups
FOR UPDATE
TO authenticated
USING (public.is_family_admin(auth.uid(), id))
WITH CHECK (public.is_family_admin(auth.uid(), id));

-- Update notify trigger: use min(personal_threshold, group_threshold)
CREATE OR REPLACE FUNCTION public.notify_family_on_large_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor_name text;
  v_personal_threshold numeric;
  v_member record;
  v_member_prefs record;
  v_group_threshold numeric;
  v_effective_threshold numeric;
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

  SELECT large_transaction_threshold INTO v_personal_threshold
  FROM notification_preferences WHERE user_id = NEW.user_id;
  v_personal_threshold := COALESCE(v_personal_threshold, 50000);

  SELECT COALESCE(display_name, 'Un membre') INTO v_actor_name
  FROM profiles WHERE user_id = NEW.user_id;

  v_title := CASE WHEN NEW.type='expense' THEN '👨‍👩‍👧 Dépense famille' ELSE '👨‍👩‍👧 Revenu famille' END;
  v_body := v_actor_name || ' • ' || NEW.description || ' • ' || to_char(NEW.amount, 'FM999G999G999');

  -- Iterate per group the actor belongs to (handles multi-group)
  FOR v_member IN
    SELECT fm2.user_id, fm1.group_id, fg.large_tx_threshold AS group_threshold
    FROM family_members fm1
    INNER JOIN family_groups fg ON fg.id = fm1.group_id
    INNER JOIN family_members fm2 ON fm2.group_id = fm1.group_id AND fm2.user_id <> fm1.user_id
    WHERE fm1.user_id = NEW.user_id
  LOOP
    v_group_threshold := COALESCE(v_member.group_threshold, 100000);
    -- Cumul: notify if amount exceeds the LOWER of the two thresholds
    v_effective_threshold := LEAST(v_personal_threshold, v_group_threshold);
    IF NEW.amount < v_effective_threshold THEN CONTINUE; END IF;

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
      headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', v_anon, 'Authorization', 'Bearer ' || v_anon),
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
