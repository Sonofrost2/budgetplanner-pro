-- 1. Étendre notification_preferences avec quotas par canal et cadences personnalisables
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS max_email_per_day integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS max_sms_per_day integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS max_whatsapp_per_day integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS quiet_hours_mode text NOT NULL DEFAULT 'defer',
  ADD COLUMN IF NOT EXISTS evening_digest_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS evening_digest_hour integer NOT NULL DEFAULT 19,
  ADD COLUMN IF NOT EXISTS deadline_lead_days integer[] NOT NULL DEFAULT ARRAY[5,2,0],
  ADD COLUMN IF NOT EXISTS coach_channels text[] NOT NULL DEFAULT ARRAY['push','email'],
  ADD COLUMN IF NOT EXISTS smart_grouping_enabled boolean NOT NULL DEFAULT true;

-- Validation
CREATE OR REPLACE FUNCTION public.validate_notification_preferences()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.morning_digest_hour < 5 OR NEW.morning_digest_hour > 11 THEN
    RAISE EXCEPTION 'morning_digest_hour must be between 5 and 11';
  END IF;
  IF NEW.evening_capture_hour < 17 OR NEW.evening_capture_hour > 22 THEN
    RAISE EXCEPTION 'evening_capture_hour must be between 17 and 22';
  END IF;
  IF NEW.evening_digest_hour < 17 OR NEW.evening_digest_hour > 22 THEN
    RAISE EXCEPTION 'evening_digest_hour must be between 17 and 22';
  END IF;
  IF NEW.status_reminder_frequency NOT IN ('weekly','every_3d','on_change_only','monthly') THEN
    RAISE EXCEPTION 'status_reminder_frequency invalid';
  END IF;
  IF NEW.quiet_hours_mode NOT IN ('defer','skip') THEN
    RAISE EXCEPTION 'quiet_hours_mode must be defer or skip';
  END IF;
  IF NEW.max_push_per_day < 1 OR NEW.max_push_per_day > 20 THEN
    RAISE EXCEPTION 'max_push_per_day must be between 1 and 20';
  END IF;
  IF NEW.max_email_per_day < 0 OR NEW.max_email_per_day > 20 THEN
    RAISE EXCEPTION 'max_email_per_day out of range';
  END IF;
  IF NEW.max_sms_per_day < 0 OR NEW.max_sms_per_day > 10 THEN
    RAISE EXCEPTION 'max_sms_per_day out of range';
  END IF;
  IF NEW.max_whatsapp_per_day < 0 OR NEW.max_whatsapp_per_day > 10 THEN
    RAISE EXCEPTION 'max_whatsapp_per_day out of range';
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Index unique sur notification_history pour dédup forte
CREATE UNIQUE INDEX IF NOT EXISTS notification_history_user_dedup_uniq
  ON public.notification_history (user_id, dedup_key)
  WHERE dedup_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS notification_history_user_channel_sent_idx
  ON public.notification_history (user_id, channel, sent_at DESC);

-- 3. notification_queue : alertes différées (quiet hours, attente fenêtre)
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  notification_type text NOT NULL,
  channel text NOT NULL,
  title text NOT NULL,
  body text,
  dedup_key text,
  reference_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS notification_queue_due_idx
  ON public.notification_queue (status, scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS notification_queue_user_ref_idx
  ON public.notification_queue (user_id, reference_id)
  WHERE status = 'pending';

ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own queued notifications"
  ON public.notification_queue FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Deny client inserts on notification_queue"
  ON public.notification_queue FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "Deny client updates on notification_queue"
  ON public.notification_queue FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "Deny client deletes on notification_queue"
  ON public.notification_queue FOR DELETE TO authenticated
  USING (false);

-- 4. alert_resolutions : trace les annulations intelligentes
CREATE TABLE IF NOT EXISTS public.alert_resolutions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  alert_type text NOT NULL,
  reference_id text NOT NULL,
  reason text NOT NULL,
  cancelled_count integer NOT NULL DEFAULT 0,
  resolved_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alert_resolutions_user_ref_idx
  ON public.alert_resolutions (user_id, reference_id, alert_type);

ALTER TABLE public.alert_resolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own alert resolutions"
  ON public.alert_resolutions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Deny client writes on alert_resolutions"
  ON public.alert_resolutions FOR ALL TO authenticated
  USING (false) WITH CHECK (false);

-- 5. Fonction centrale : doit-on envoyer ?
CREATE OR REPLACE FUNCTION public.should_send_notification(
  p_user_id uuid,
  p_channel text,
  p_dedup_key text,
  p_dedup_window_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_prefs record;
  v_quota integer;
  v_sent_today integer;
  v_already boolean;
  v_in_quiet boolean := false;
  v_hour integer;
BEGIN
  SELECT * INTO v_prefs FROM notification_preferences WHERE user_id = p_user_id;
  IF v_prefs IS NULL THEN
    RETURN jsonb_build_object('allow', false, 'reason', 'no_prefs');
  END IF;

  -- Dedup check
  IF p_dedup_key IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM notification_history
      WHERE user_id = p_user_id AND dedup_key = p_dedup_key
        AND sent_at > now() - (p_dedup_window_days || ' days')::interval
    ) INTO v_already;
    IF v_already THEN
      RETURN jsonb_build_object('allow', false, 'reason', 'dedup');
    END IF;
  END IF;

  -- Quiet hours
  IF v_prefs.quiet_hours_enabled THEN
    v_hour := EXTRACT(HOUR FROM now() AT TIME ZONE 'UTC')::int;
    IF v_prefs.quiet_hours_start > v_prefs.quiet_hours_end THEN
      v_in_quiet := v_hour >= v_prefs.quiet_hours_start OR v_hour < v_prefs.quiet_hours_end;
    ELSE
      v_in_quiet := v_hour >= v_prefs.quiet_hours_start AND v_hour < v_prefs.quiet_hours_end;
    END IF;
    IF v_in_quiet THEN
      RETURN jsonb_build_object(
        'allow', false,
        'reason', CASE WHEN v_prefs.quiet_hours_mode = 'defer' THEN 'defer' ELSE 'quiet' END,
        'defer_until_hour', v_prefs.quiet_hours_end
      );
    END IF;
  END IF;

  -- Quota
  v_quota := CASE p_channel
    WHEN 'push' THEN v_prefs.max_push_per_day
    WHEN 'email' THEN v_prefs.max_email_per_day
    WHEN 'sms' THEN v_prefs.max_sms_per_day
    WHEN 'whatsapp' THEN v_prefs.max_whatsapp_per_day
    ELSE 100
  END;

  SELECT COUNT(*) INTO v_sent_today
  FROM notification_history
  WHERE user_id = p_user_id AND channel = p_channel
    AND sent_at >= date_trunc('day', now());

  IF v_sent_today >= v_quota THEN
    RETURN jsonb_build_object('allow', false, 'reason', 'quota_exceeded',
      'sent_today', v_sent_today, 'quota', v_quota);
  END IF;

  RETURN jsonb_build_object('allow', true, 'sent_today', v_sent_today, 'quota', v_quota);
END;
$function$;

-- 6. Fonction : résoudre les alertes en attente (anticipation utilisateur)
CREATE OR REPLACE FUNCTION public.resolve_pending_alerts(
  p_user_id uuid,
  p_alert_types text[],
  p_reference_id text,
  p_reason text DEFAULT 'user_action'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE notification_queue
  SET status = 'resolved', processed_at = now(), last_error = p_reason
  WHERE user_id = p_user_id
    AND status = 'pending'
    AND reference_id = p_reference_id
    AND notification_type = ANY(p_alert_types);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    INSERT INTO alert_resolutions (user_id, alert_type, reference_id, reason, cancelled_count)
    VALUES (p_user_id, p_alert_types[1], p_reference_id, p_reason, v_count);
  END IF;

  RETURN v_count;
END;
$function$;

-- 7. Trigger : si une dette est intégralement payée, résoudre rappels
CREATE OR REPLACE FUNCTION public.resolve_alerts_on_debt_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.paid_amount >= NEW.total_amount AND (OLD.paid_amount IS NULL OR OLD.paid_amount < OLD.total_amount) THEN
    PERFORM public.resolve_pending_alerts(
      NEW.user_id,
      ARRAY['debt_due_soon','debt_overdue'],
      NEW.id::text,
      'debt_paid'
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS resolve_alerts_on_debt_payment_trg ON public.debts;
CREATE TRIGGER resolve_alerts_on_debt_payment_trg
  AFTER UPDATE ON public.debts
  FOR EACH ROW EXECUTE FUNCTION public.resolve_alerts_on_debt_payment();

-- 8. Trigger : si un objectif d'épargne est atteint, résoudre rappels contribution
CREATE OR REPLACE FUNCTION public.resolve_alerts_on_savings_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.current_amount >= NEW.target_amount AND (OLD.current_amount IS NULL OR OLD.current_amount < OLD.target_amount) THEN
    PERFORM public.resolve_pending_alerts(
      NEW.user_id,
      ARRAY['savings_contribution_due','savings_behind'],
      NEW.id::text,
      'goal_reached'
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS resolve_alerts_on_savings_progress_trg ON public.savings_goals;
CREATE TRIGGER resolve_alerts_on_savings_progress_trg
  AFTER UPDATE ON public.savings_goals
  FOR EACH ROW EXECUTE FUNCTION public.resolve_alerts_on_savings_progress();