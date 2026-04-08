import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
        });
      } else if (!error) {
        // Create default prefs for this user
        await supabase.from('notification_preferences').insert({ user_id: user.id });
      }
      setLoading(false);
    })();
  }, [user]);

  const updatePref = useCallback(async (key: keyof NotificationPreferences, value: boolean | number) => {
    if (!user) return;
    setPrefs(prev => ({ ...prev, [key]: value }));
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
