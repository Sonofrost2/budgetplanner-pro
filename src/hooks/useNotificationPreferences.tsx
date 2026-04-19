import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type StatusFrequency = 'weekly' | 'every_3d' | 'on_change_only';

export interface NotificationPreferences {
  budget_alerts: boolean;
  budget_projections: boolean;
  daily_budget: boolean;
  savings_reminders: boolean;
  recurring_reminders: boolean;
  debt_alerts: boolean;
  balance_discrepancy: boolean;
  weekly_summary: boolean;
  large_transaction: boolean;
  large_transaction_threshold: number;
  low_balance: boolean;
  low_balance_threshold: number;
  goal_reached: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: number;
  quiet_hours_end: number;
  // Cadence & moments
  morning_digest_enabled: boolean;
  morning_digest_hour: number;
  evening_capture_enabled: boolean;
  evening_capture_hour: number;
  status_reminder_frequency: StatusFrequency;
  max_push_per_day: number;
}

const defaultPrefs: NotificationPreferences = {
  budget_alerts: true,
  budget_projections: true,
  daily_budget: true,
  savings_reminders: true,
  recurring_reminders: true,
  debt_alerts: true,
  balance_discrepancy: true,
  weekly_summary: true,
  large_transaction: true,
  large_transaction_threshold: 50000,
  low_balance: false,
  low_balance_threshold: 5000,
  goal_reached: true,
  quiet_hours_enabled: false,
  quiet_hours_start: 22,
  quiet_hours_end: 7,
  morning_digest_enabled: true,
  morning_digest_hour: 7,
  evening_capture_enabled: true,
  evening_capture_hour: 20,
  status_reminder_frequency: 'weekly',
  max_push_per_day: 3,
};

export const useNotificationPreferences = () => {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferences>(defaultPrefs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setPrefs({
          budget_alerts: data.budget_alerts,
          budget_projections: data.budget_projections,
          daily_budget: data.daily_budget,
          savings_reminders: data.savings_reminders,
          recurring_reminders: data.recurring_reminders,
          debt_alerts: data.debt_alerts,
          balance_discrepancy: data.balance_discrepancy,
          weekly_summary: data.weekly_summary,
          large_transaction: data.large_transaction,
          large_transaction_threshold: Number(data.large_transaction_threshold),
          low_balance: data.low_balance,
          low_balance_threshold: Number(data.low_balance_threshold),
          goal_reached: data.goal_reached,
          quiet_hours_enabled: data.quiet_hours_enabled,
          quiet_hours_start: data.quiet_hours_start,
          quiet_hours_end: data.quiet_hours_end,
          morning_digest_enabled: (data as any).morning_digest_enabled ?? true,
          morning_digest_hour: (data as any).morning_digest_hour ?? 7,
          evening_capture_enabled: (data as any).evening_capture_enabled ?? true,
          evening_capture_hour: (data as any).evening_capture_hour ?? 20,
          status_reminder_frequency: ((data as any).status_reminder_frequency ?? 'weekly') as StatusFrequency,
          max_push_per_day: (data as any).max_push_per_day ?? 3,
        });
      } else if (!error) {
        await supabase.from('notification_preferences').insert({ user_id: user.id });
      }
      setLoading(false);
    })();
  }, [user]);

  const updatePref = useCallback(async (
    key: keyof NotificationPreferences,
    value: boolean | number | string
  ) => {
    if (!user) return;
    setPrefs(prev => ({ ...prev, [key]: value as never }));
    setSaving(true);
    const { error } = await supabase
      .from('notification_preferences')
      .update({ [key]: value } as any)
      .eq('user_id', user.id);
    setSaving(false);
    if (error) toast.error(error.message);
  }, [user]);

  return { prefs, loading, saving, updatePref };
};
