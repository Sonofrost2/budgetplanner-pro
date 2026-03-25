CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  budget_alerts boolean NOT NULL DEFAULT true,
  budget_projections boolean NOT NULL DEFAULT true,
  daily_budget boolean NOT NULL DEFAULT true,
  savings_reminders boolean NOT NULL DEFAULT true,
  recurring_reminders boolean NOT NULL DEFAULT true,
  debt_alerts boolean NOT NULL DEFAULT true,
  balance_discrepancy boolean NOT NULL DEFAULT true,
  weekly_summary boolean NOT NULL DEFAULT true,
  large_transaction boolean NOT NULL DEFAULT true,
  large_transaction_threshold numeric NOT NULL DEFAULT 50000,
  low_balance boolean NOT NULL DEFAULT false,
  low_balance_threshold numeric NOT NULL DEFAULT 5000,
  goal_reached boolean NOT NULL DEFAULT true,
  quiet_hours_enabled boolean NOT NULL DEFAULT false,
  quiet_hours_start integer NOT NULL DEFAULT 22,
  quiet_hours_end integer NOT NULL DEFAULT 7,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notification preferences"
  ON public.notification_preferences
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.create_default_notification_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_create_notification_prefs
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_notification_preferences();