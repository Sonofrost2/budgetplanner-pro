import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type StatusFrequency = 'weekly' | 'every_3d' | 'on_change_only' | 'monthly';
export type QuietHoursMode = 'defer' | 'skip';
export type CoachChannel = 'push' | 'email' | 'sms' | 'whatsapp';
export type FactualDeliveryMode = 'immediate' | 'morning' | 'evening';
export type ReminderDeliveryMode = 'immediate' | 'morning' | 'evening' | 'both';

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
  savings_deadline_alerts: boolean;
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
  max_email_per_day: number;
  max_sms_per_day: number;
  max_whatsapp_per_day: number;
  quiet_hours_mode: QuietHoursMode;
  evening_digest_enabled: boolean;
  evening_digest_hour: number;
  deadline_lead_days: number[];
  coach_channels: CoachChannel[];
  smart_grouping_enabled: boolean;
  factual_delivery_mode: FactualDeliveryMode;
  reminder_delivery_mode: ReminderDeliveryMode;
  // Channels (Twilio)
  notify_via_sms: boolean;
  notify_via_whatsapp: boolean;
  // Subscription / billing notifications
  notify_payment_receipts: boolean;
  notify_subscription_expiry: boolean;
  notify_payment_failure: boolean;
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
  savings_deadline_alerts: true,
  quiet_hours_enabled: false,
  quiet_hours_start: 22,
  quiet_hours_end: 7,
  morning_digest_enabled: true,
  morning_digest_hour: 7,
  evening_capture_enabled: true,
  evening_capture_hour: 20,
  status_reminder_frequency: 'weekly',
  max_push_per_day: 3,
  max_email_per_day: 5,
  max_sms_per_day: 2,
  max_whatsapp_per_day: 3,
  quiet_hours_mode: 'defer',
  evening_digest_enabled: false,
  evening_digest_hour: 19,
  deadline_lead_days: [5, 2, 0],
  coach_channels: ['push', 'email'],
  smart_grouping_enabled: true,
  factual_delivery_mode: 'immediate',
  reminder_delivery_mode: 'morning',
  notify_via_sms: false,
  notify_via_whatsapp: false,
  notify_payment_receipts: true,
  notify_subscription_expiry: true,
  notify_payment_failure: true,
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
          savings_deadline_alerts: (data as any).savings_deadline_alerts ?? true,
          quiet_hours_enabled: data.quiet_hours_enabled,
          quiet_hours_start: data.quiet_hours_start,
          quiet_hours_end: data.quiet_hours_end,
          morning_digest_enabled: (data as any).morning_digest_enabled ?? true,
          morning_digest_hour: (data as any).morning_digest_hour ?? 7,
          evening_capture_enabled: (data as any).evening_capture_enabled ?? true,
          evening_capture_hour: (data as any).evening_capture_hour ?? 20,
          status_reminder_frequency: ((data as any).status_reminder_frequency ?? 'weekly') as StatusFrequency,
          max_push_per_day: (data as any).max_push_per_day ?? 3,
          max_email_per_day: (data as any).max_email_per_day ?? 5,
          max_sms_per_day: (data as any).max_sms_per_day ?? 2,
          max_whatsapp_per_day: (data as any).max_whatsapp_per_day ?? 3,
          quiet_hours_mode: ((data as any).quiet_hours_mode ?? 'defer') as QuietHoursMode,
          evening_digest_enabled: (data as any).evening_digest_enabled ?? false,
          evening_digest_hour: (data as any).evening_digest_hour ?? 19,
          deadline_lead_days: (data as any).deadline_lead_days ?? [5, 2, 0],
          coach_channels: ((data as any).coach_channels ?? ['push', 'email']) as CoachChannel[],
          smart_grouping_enabled: (data as any).smart_grouping_enabled ?? true,
          factual_delivery_mode: ((data as any).factual_delivery_mode ?? 'immediate') as FactualDeliveryMode,
          reminder_delivery_mode: ((data as any).reminder_delivery_mode ?? 'morning') as ReminderDeliveryMode,
          notify_via_sms: (data as any).notify_via_sms ?? false,
          notify_via_whatsapp: (data as any).notify_via_whatsapp ?? false,
          notify_payment_receipts: (data as any).notify_payment_receipts ?? true,
          notify_subscription_expiry: (data as any).notify_subscription_expiry ?? true,
          notify_payment_failure: (data as any).notify_payment_failure ?? true,
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
