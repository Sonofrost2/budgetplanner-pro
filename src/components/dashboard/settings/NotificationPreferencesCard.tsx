import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Bell, TrendingUp, Wallet, PiggyBank, RotateCcw, AlertTriangle, Scale, Calendar, Zap, Moon, Target, ChevronDown, ChevronUp, Sunrise, Sunset, Clock, MessageSquare, Phone, Mail, CreditCard, Inbox, Info } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  locale: string;
}

const NotificationPreferencesCard = ({ locale }: Props) => {
  const { subscribed, subscribe, unsubscribe, loading: pushLoading, isSupported, permission } = usePushNotifications();
  const { prefs, loading, updatePref } = useNotificationPreferences();
  const { user } = useAuth();
  const [testLoading, setTestLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const isFr = locale === 'fr';
  const isDesktop = !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  const handleToggle = async (checked: boolean) => {
    if (checked) {
      const ok = await subscribe();
      if (ok) toast.success(isFr ? 'Notifications activées' : 'Notifications enabled');
      else if (permission === 'denied') toast.error(isFr ? 'Notifications bloquées par le navigateur.' : 'Notifications blocked by browser.');
    } else {
      await unsubscribe();
      toast.success(isFr ? 'Notifications désactivées' : 'Notifications disabled');
    }
  };

  const handleTestPush = async () => {
    if (!user) return;
    setTestLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('push-notify', {
        body: {
          user_id: user.id,
          title: isFr ? '🔔 Test réussi !' : '🔔 Test successful!',
          body: isFr ? 'Les notifications push fonctionnent correctement.' : 'Push notifications are working correctly.',
          data: { url: '/dashboard/settings' },
        },
      });
      if (error) throw error;
      if (data?.sent > 0) toast.success(isFr ? 'Notification envoyée !' : 'Notification sent!');
      else toast.warning(isFr ? 'Aucun appareil abonné trouvé' : 'No subscribed device found');
    } catch (err: any) {
      toast.error(err.message || 'Error');
    } finally {
      setTestLoading(false);
    }
  };

  const notifTypes = [
    {
      key: 'budget_alerts' as const,
      icon: <Wallet className="w-4 h-4 text-orange-500" />,
      label: isFr ? 'Alertes de budget' : 'Budget alerts',
      desc: isFr ? 'Dépassement de seuil (80%, 100%)' : 'Threshold exceeded (80%, 100%)',
    },
    {
      key: 'budget_projections' as const,
      icon: <TrendingUp className="w-4 h-4 text-blue-500" />,
      label: isFr ? 'Projections de budget' : 'Budget projections',
      desc: isFr ? 'Dépassement estimé dans X jours' : 'Projected to exceed in X days',
    },
    {
      key: 'daily_budget' as const,
      icon: <Zap className="w-4 h-4 text-yellow-500" />,
      label: isFr ? 'Budget journalier' : 'Daily budget',
      desc: isFr ? 'Alerte quand le budget du jour est dépassé' : 'Alert when daily budget is exceeded',
    },
    {
      key: 'savings_reminders' as const,
      icon: <PiggyBank className="w-4 h-4 text-green-500" />,
      label: isFr ? 'Rappels d\'épargne' : 'Savings reminders',
      desc: isFr ? 'Jour de cotisation et rappels mensuels' : 'Contribution day and monthly reminders',
    },
    {
      key: 'goal_reached' as const,
      icon: <Target className="w-4 h-4 text-emerald-500" />,
      label: isFr ? 'Objectifs atteints' : 'Goals reached',
      desc: isFr ? 'Quand un objectif d\'épargne ou budget est atteint' : 'When a savings or budget goal is reached',
    },
    {
      key: 'savings_deadline_alerts' as const,
      icon: <Target className="w-4 h-4 text-amber-500" />,
      label: isFr ? 'Échéances d\'épargne' : 'Savings deadlines',
      desc: isFr
        ? 'Rappels J-30/J-7/J-2/J-0 et alerte si l\'échéance est dépassée (fréquence configurable ci-dessous)'
        : 'Reminders D-30/D-7/D-2/D-0 and alert if the deadline is exceeded (frequency configurable below)',
    },
    {
      key: 'recurring_reminders' as const,
      icon: <RotateCcw className="w-4 h-4 text-purple-500" />,
      label: isFr ? 'Échéances récurrentes' : 'Recurring due dates',
      desc: isFr ? 'Rappels de transactions récurrentes' : 'Recurring transaction reminders',
    },
    {
      key: 'debt_alerts' as const,
      icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
      label: isFr ? 'Alertes de dettes' : 'Debt alerts',
      desc: isFr ? 'Échéances et retards de paiement' : 'Due dates and overdue payments',
    },
    {
      key: 'balance_discrepancy' as const,
      icon: <Scale className="w-4 h-4 text-amber-500" />,
      label: isFr ? 'Écart de solde' : 'Balance discrepancy',
      desc: isFr ? 'Quand le solde réel diffère du théorique' : 'When actual balance differs from calculated',
    },
    {
      key: 'large_transaction' as const,
      icon: <Zap className="w-4 h-4 text-rose-500" />,
      label: isFr ? 'Grosse transaction' : 'Large transaction',
      desc: isFr ? 'Quand une transaction dépasse un seuil' : 'When a transaction exceeds a threshold',
      hasThreshold: true,
      thresholdKey: 'large_transaction_threshold' as const,
      thresholdLabel: isFr ? 'Seuil' : 'Threshold',
    },
    {
      key: 'low_balance' as const,
      icon: <Wallet className="w-4 h-4 text-red-600" />,
      label: isFr ? 'Solde bas' : 'Low balance',
      desc: isFr ? 'Quand un compte descend sous un seuil' : 'When an account drops below a threshold',
      hasThreshold: true,
      thresholdKey: 'low_balance_threshold' as const,
      thresholdLabel: isFr ? 'Seuil' : 'Threshold',
    },
    {
      key: 'weekly_summary' as const,
      icon: <Calendar className="w-4 h-4 text-indigo-500" />,
      label: isFr ? 'Bilan hebdomadaire' : 'Weekly summary',
      desc: isFr ? 'Récapitulatif chaque dimanche' : 'Summary every Sunday',
    },
  ];

  return (
    <Card className="border-none shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="w-4 h-4" />
          {isFr ? 'Notifications push' : 'Push notifications'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              {isFr ? 'Activer les notifications' : 'Enable notifications'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isFr ? 'Recevez des notifications même quand l\'app est fermée' : 'Get notified even when the app is closed'}
            </p>
          </div>
          <Switch checked={subscribed} onCheckedChange={handleToggle} disabled={pushLoading} />
        </div>

        {/* Status messages */}
        {!isSupported && (
          <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-xl px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            {isFr ? 'Ce navigateur ne supporte pas les notifications push' : 'This browser does not support push notifications'}
          </div>
        )}
        {isSupported && permission === 'denied' && (
          <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-xl px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            {isFr ? 'Notifications bloquées. Vérifiez les paramètres du navigateur.' : 'Notifications blocked. Check browser settings.'}
          </div>
        )}
        {subscribed && (
          <div className="flex items-center gap-2 text-xs text-secondary bg-secondary/10 rounded-xl px-3 py-2">
            <Bell className="w-3.5 h-3.5 flex-shrink-0" />
            {isFr ? '✅ Notifications actives sur cet appareil' : '✅ Notifications active on this device'}
            {isDesktop && <span className="ml-auto text-muted-foreground">{isFr ? '(Bureau)' : '(Desktop)'}</span>}
          </div>
        )}

        {/* Test button */}
        {subscribed && (
          <Button variant="outline" size="sm" className="rounded-xl w-full" onClick={handleTestPush} disabled={testLoading}>
            <Bell className="w-3.5 h-3.5 mr-1.5" />
            {testLoading ? '...' : (isFr ? 'Envoyer une notification test' : 'Send a test notification')}
          </Button>
        )}

        {/* Desktop tip */}
        {isDesktop && !subscribed && isSupported && permission !== 'denied' && (
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-xl px-3 py-2 space-y-1">
            <p className="font-medium">{isFr ? '💡 Astuce PC' : '💡 Desktop tip'}</p>
            <p>{isFr
              ? 'Activez les notifications pour recevoir des alertes en temps réel, même quand l\'app est en arrière-plan.'
              : 'Enable notifications to get real-time alerts, even when the app is in the background.'
            }</p>
          </div>
        )}

        {/* === Cadence & moments — always visible (server-side prefs, not device-bound) === */}
        {!loading && (
          <>
            <Separator />

            <div className="space-y-4">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                {isFr ? 'Cadence & moments' : 'Cadence & timing'}
              </p>

              {/* === Delivery mode (routing per family) === */}
              <div className="rounded-2xl border border-border/60 bg-muted/30 p-3 space-y-3">
                <div className="flex items-start gap-2">
                  <Inbox className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {isFr ? 'Mode de livraison' : 'Delivery mode'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isFr
                        ? 'Choisis quand recevoir chaque type d\'alerte. Les paiements et échecs critiques restent toujours immédiats.'
                        : 'Choose when to receive each type of alert. Critical payment failures always stay immediate.'}
                    </p>
                  </div>
                </div>

                {/* Factual */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-rose-500" />
                    {isFr ? 'Alertes factuelles' : 'Factual alerts'}
                    <span className="text-muted-foreground font-normal">
                      {isFr ? '(grosse transaction, écart, objectif atteint…)' : '(large tx, discrepancy, goal reached…)'}
                    </span>
                  </Label>
                  <Select
                    value={prefs.factual_delivery_mode}
                    onValueChange={(v) => updatePref('factual_delivery_mode', v)}
                  >
                    <SelectTrigger className="rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">{isFr ? '⚡ Immédiat (recommandé)' : '⚡ Immediate (recommended)'}</SelectItem>
                      <SelectItem value="morning">{isFr ? '☀️ Regrouper dans le digest matinal' : '☀️ Group in morning digest'}</SelectItem>
                      <SelectItem value="evening">{isFr ? '🌙 Regrouper dans le digest du soir' : '🌙 Group in evening digest'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Reminder */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    {isFr ? 'Rappels périodiques' : 'Periodic reminders'}
                    <span className="text-muted-foreground font-normal">
                      {isFr ? '(échéances, projections, épargne…)' : '(deadlines, projections, savings…)'}
                    </span>
                  </Label>
                  <Select
                    value={prefs.reminder_delivery_mode}
                    onValueChange={(v) => updatePref('reminder_delivery_mode', v)}
                  >
                    <SelectTrigger className="rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="immediate">{isFr ? '⚡ Immédiat (chaque rappel)' : '⚡ Immediate (each reminder)'}</SelectItem>
                      <SelectItem value="morning">{isFr ? '☀️ Digest matinal (recommandé)' : '☀️ Morning digest (recommended)'}</SelectItem>
                      <SelectItem value="evening">{isFr ? '🌙 Digest du soir' : '🌙 Evening digest'}</SelectItem>
                      <SelectItem value="both">{isFr ? '☀️🌙 Matin + soir' : '☀️🌙 Morning + evening'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground bg-background/40 rounded-lg px-2 py-1.5">
                  <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>
                    {isFr
                      ? 'Les heures des digests se règlent ci-dessous (matin / soir).'
                      : 'Digest hours can be configured below (morning / evening).'}
                  </span>
                </div>
              </div>

              {/* Morning digest */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Sunrise className="w-4 h-4 mt-0.5 text-amber-500" />
                    <div>
                      <p className="text-sm font-medium">{isFr ? 'Digest matinal' : 'Morning digest'}</p>
                      <p className="text-xs text-muted-foreground">{isFr ? 'Une seule notification résumant les alertes du matin' : 'A single notification summarizing morning alerts'}</p>
                    </div>
                  </div>
                  <Switch checked={prefs.morning_digest_enabled} onCheckedChange={(v) => updatePref('morning_digest_enabled', v)} />
                </div>
                {prefs.morning_digest_enabled && (
                  <div className="ml-6 flex items-center gap-2 text-xs">
                    <Label className="text-muted-foreground">{isFr ? 'Heure' : 'Hour'}</Label>
                    <Input type="number" min={5} max={11} className="rounded-xl h-8 w-16 text-xs text-center"
                      value={prefs.morning_digest_hour}
                      onChange={(e) => { const v = Number(e.target.value); if (v >= 5 && v <= 11) updatePref('morning_digest_hour', v); }} />
                    <span className="text-muted-foreground">h</span>
                  </div>
                )}
              </div>

              {/* Evening capture reminder */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Sunset className="w-4 h-4 mt-0.5 text-orange-600" />
                    <div>
                      <p className="text-sm font-medium">{isFr ? 'Rappel de saisie du soir' : 'Evening capture reminder'}</p>
                      <p className="text-xs text-muted-foreground">{isFr ? 'Te rappelle chaque soir de saisir tes transactions' : 'Reminds you each evening to log transactions'}</p>
                    </div>
                  </div>
                  <Switch checked={prefs.evening_capture_enabled} onCheckedChange={(v) => updatePref('evening_capture_enabled', v)} />
                </div>
                {prefs.evening_capture_enabled && (
                  <div className="ml-6 flex items-center gap-2 text-xs">
                    <Label className="text-muted-foreground">{isFr ? 'Heure' : 'Hour'}</Label>
                    <Input type="number" min={17} max={22} className="rounded-xl h-8 w-16 text-xs text-center"
                      value={prefs.evening_capture_hour}
                      onChange={(e) => { const v = Number(e.target.value); if (v >= 17 && v <= 22) updatePref('evening_capture_hour', v); }} />
                    <span className="text-muted-foreground">h</span>
                  </div>
                )}
              </div>

              {/* Status reminder cadence */}
              <div className="flex items-start gap-2.5">
                <RotateCcw className="w-4 h-4 mt-0.5 text-purple-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{isFr ? 'Cadence des rappels d\'état' : 'Status reminder cadence'}</p>
                  <p className="text-xs text-muted-foreground mb-2">{isFr ? 'Fréquence des alertes non urgentes' : 'How often to repeat non-urgent alerts'}</p>
                  <Select value={prefs.status_reminder_frequency} onValueChange={(v) => updatePref('status_reminder_frequency', v)}>
                    <SelectTrigger className="rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">{isFr ? '1× par semaine' : 'Once a week'}</SelectItem>
                      <SelectItem value="every_3d">{isFr ? 'Tous les 3 jours' : 'Every 3 days'}</SelectItem>
                      <SelectItem value="on_change_only">{isFr ? 'Seulement si ça change' : 'Only when status changes'}</SelectItem>
                      <SelectItem value="monthly">{isFr ? '1× par mois' : 'Once a month'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Evening digest (J-1 deadlines) — opt-in */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <Sunset className="w-4 h-4 mt-0.5 text-purple-500" />
                    <div>
                      <p className="text-sm font-medium">{isFr ? 'Digest du soir (échéances J-1)' : 'Evening digest (D-1 deadlines)'}</p>
                      <p className="text-xs text-muted-foreground">{isFr ? 'Récapitulatif des échéances de demain' : "Recap of tomorrow's deadlines"}</p>
                    </div>
                  </div>
                  <Switch checked={prefs.evening_digest_enabled} onCheckedChange={(v) => updatePref('evening_digest_enabled', v)} />
                </div>
                {prefs.evening_digest_enabled && (
                  <div className="ml-6 flex items-center gap-2 text-xs">
                    <Label className="text-muted-foreground">{isFr ? 'Heure' : 'Hour'}</Label>
                    <Input type="number" min={17} max={22} className="rounded-xl h-8 w-16 text-xs text-center"
                      value={prefs.evening_digest_hour}
                      onChange={(e) => { const v = Number(e.target.value); if (v >= 17 && v <= 22) updatePref('evening_digest_hour', v); }} />
                    <span className="text-muted-foreground">h</span>
                  </div>
                )}
              </div>

              {/* Per-channel daily quotas */}
              <div className="flex items-start gap-2.5">
                <Bell className="w-4 h-4 mt-0.5 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{isFr ? 'Plafonds quotidiens par canal' : 'Daily caps per channel'}</p>
                  <p className="text-xs text-muted-foreground mb-2">{isFr ? 'Au-delà, les alertes sont regroupées' : 'Beyond, alerts are grouped'}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { key: 'max_push_per_day' as const, label: 'Push', max: 20 },
                      { key: 'max_email_per_day' as const, label: 'Email', max: 20 },
                      { key: 'max_sms_per_day' as const, label: 'SMS', max: 10 },
                      { key: 'max_whatsapp_per_day' as const, label: 'WhatsApp', max: 10 },
                    ]).map((q) => (
                      <div key={q.key} className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground w-16">{q.label}</Label>
                        <Input type="number" min={0} max={q.max} className="rounded-xl h-8 w-16 text-xs text-center"
                          value={prefs[q.key]}
                          onChange={(e) => { const v = Number(e.target.value); if (v >= 0 && v <= q.max) updatePref(q.key, v); }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Coach channels — multi-select */}
              <div className="flex items-start gap-2.5">
                <MessageSquare className="w-4 h-4 mt-0.5 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{isFr ? 'Canaux des alertes Coach' : 'Coach alert channels'}</p>
                  <p className="text-xs text-muted-foreground mb-2">{isFr ? 'Où recevoir budgets, épargne, dettes…' : 'Where to receive budgets, savings, debts…'}</p>
                  <div className="flex flex-wrap gap-2">
                    {(['push','email','sms','whatsapp'] as const).map((c) => {
                      const selected = prefs.coach_channels.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => {
                            const next = selected
                              ? prefs.coach_channels.filter(x => x !== c)
                              : [...prefs.coach_channels, c];
                            if (next.length === 0) return;
                            updatePref('coach_channels', next as any);
                          }}
                          className={`px-3 py-1 rounded-full text-xs border transition-colors ${selected ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
                        >
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <Separator />
            <button
              className="flex items-center justify-between w-full text-sm font-medium py-1 hover:text-primary transition-colors"
              onClick={() => setExpanded(!expanded)}
            >
              <span>{isFr ? '⚙️ Personnaliser les notifications' : '⚙️ Customize notifications'}</span>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {expanded && (
              <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
                {notifTypes.map((notif) => (
                  <div key={notif.key} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="mt-0.5 flex-shrink-0">{notif.icon}</div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium leading-tight">{notif.label}</p>
                          <p className="text-xs text-muted-foreground leading-tight">{notif.desc}</p>
                        </div>
                      </div>
                      <Switch
                        checked={prefs[notif.key] as boolean}
                        onCheckedChange={(v) => updatePref(notif.key, v)}
                        className="flex-shrink-0"
                      />
                    </div>
                    {notif.hasThreshold && prefs[notif.key] && (
                      <div className="ml-6.5 flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">{notif.thresholdLabel}:</Label>
                        <Input
                          type="number"
                          className="rounded-xl h-8 w-28 text-xs"
                          value={prefs[notif.thresholdKey!]}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (val >= 0) updatePref(notif.thresholdKey!, val);
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}

                {/* Quiet hours */}
                <Separator />
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <Moon className="w-4 h-4 mt-0.5 text-indigo-400" />
                      <div>
                        <p className="text-sm font-medium">{isFr ? 'Heures silencieuses' : 'Quiet hours'}</p>
                        <p className="text-xs text-muted-foreground">{isFr ? 'Pas de notifications pendant ces heures' : 'No notifications during these hours'}</p>
                      </div>
                    </div>
                    <Switch
                      checked={prefs.quiet_hours_enabled}
                      onCheckedChange={(v) => updatePref('quiet_hours_enabled', v)}
                    />
                  </div>
                  {prefs.quiet_hours_enabled && (
                    <div className="ml-6.5 space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                      <Label className="text-muted-foreground">{isFr ? 'De' : 'From'}</Label>
                      <Input
                        type="number"
                        min={0} max={23}
                        className="rounded-xl h-8 w-16 text-xs text-center"
                        value={prefs.quiet_hours_start}
                        onChange={(e) => updatePref('quiet_hours_start', Number(e.target.value))}
                      />
                      <span className="text-muted-foreground">h</span>
                      <Label className="text-muted-foreground">{isFr ? 'à' : 'to'}</Label>
                      <Input
                        type="number"
                        min={0} max={23}
                        className="rounded-xl h-8 w-16 text-xs text-center"
                        value={prefs.quiet_hours_end}
                        onChange={(e) => updatePref('quiet_hours_end', Number(e.target.value))}
                      />
                      <span className="text-muted-foreground">h</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Label className="text-muted-foreground">{isFr ? 'Comportement' : 'Behavior'}</Label>
                        <Select value={prefs.quiet_hours_mode} onValueChange={(v) => updatePref('quiet_hours_mode', v)}>
                          <SelectTrigger className="rounded-xl h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="defer">{isFr ? 'Différer (envoyer plus tard)' : 'Defer (send later)'}</SelectItem>
                            <SelectItem value="skip">{isFr ? 'Ignorer' : 'Skip'}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* === Channels (SMS / WhatsApp / Email) === */}
            <Separator />
            <div className="space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                {isFr ? 'Canaux de réception' : 'Receiving channels'}
              </p>
              <p className="text-xs text-muted-foreground -mt-1">
                {isFr
                  ? 'Choisis comment recevoir les notifications importantes (paiements, expirations, alertes).'
                  : 'Choose how to receive important notifications (payments, expirations, alerts).'}
              </p>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Phone className="w-4 h-4 mt-0.5 text-emerald-500" />
                  <div>
                    <p className="text-sm font-medium">SMS</p>
                    <p className="text-xs text-muted-foreground">
                      {isFr ? 'Nécessite un numéro de téléphone valide' : 'Requires a valid phone number'}
                    </p>
                  </div>
                </div>
                <Switch checked={prefs.notify_via_sms} onCheckedChange={(v) => updatePref('notify_via_sms', v)} />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <MessageSquare className="w-4 h-4 mt-0.5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">WhatsApp</p>
                    <p className="text-xs text-muted-foreground">
                      {isFr ? 'Le numéro doit être joignable sur WhatsApp' : 'Number must be reachable on WhatsApp'}
                    </p>
                  </div>
                </div>
                <Switch checked={prefs.notify_via_whatsapp} onCheckedChange={(v) => updatePref('notify_via_whatsapp', v)} />
              </div>
            </div>

            {/* === Subscription / billing notifications === */}
            <Separator />
            <div className="space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                {isFr ? 'Abonnement & facturation' : 'Subscription & billing'}
              </p>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Mail className="w-4 h-4 mt-0.5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium">{isFr ? 'Reçus de paiement' : 'Payment receipts'}</p>
                    <p className="text-xs text-muted-foreground">{isFr ? 'Confirmation immédiate après chaque paiement' : 'Immediate confirmation after each payment'}</p>
                  </div>
                </div>
                <Switch checked={prefs.notify_payment_receipts} onCheckedChange={(v) => updatePref('notify_payment_receipts', v)} />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Calendar className="w-4 h-4 mt-0.5 text-amber-500" />
                  <div>
                    <p className="text-sm font-medium">{isFr ? 'Rappels d\'expiration' : 'Expiry reminders'}</p>
                    <p className="text-xs text-muted-foreground">{isFr ? 'J-7, J-1 et le jour de l\'expiration' : 'D-7, D-1 and on expiry day'}</p>
                  </div>
                </div>
                <Switch checked={prefs.notify_subscription_expiry} onCheckedChange={(v) => updatePref('notify_subscription_expiry', v)} />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 mt-0.5 text-red-500" />
                  <div>
                    <p className="text-sm font-medium">{isFr ? 'Échec de paiement' : 'Payment failure'}</p>
                    <p className="text-xs text-muted-foreground">{isFr ? 'Alerte en cas d\'échec de renouvellement' : 'Alert when renewal fails'}</p>
                  </div>
                </div>
                <Switch checked={prefs.notify_payment_failure} onCheckedChange={(v) => updatePref('notify_payment_failure', v)} />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default NotificationPreferencesCard;
