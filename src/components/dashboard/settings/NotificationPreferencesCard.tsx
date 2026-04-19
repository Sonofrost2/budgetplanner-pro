import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Bell, TrendingUp, Wallet, PiggyBank, RotateCcw, AlertTriangle, Scale, Calendar, Zap, Moon, Target, ChevronDown, ChevronUp, Sunrise, Sunset, Clock } from 'lucide-react';
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

        {/* Notification types configuration */}
        {subscribed && !loading && (
          <>
            <Separator />

            {/* === Cadence & moments — always visible === */}
            <div className="space-y-4">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                {isFr ? 'Cadence & moments' : 'Cadence & timing'}
              </p>

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
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Daily push cap */}
              <div className="flex items-start gap-2.5">
                <Bell className="w-4 h-4 mt-0.5 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{isFr ? 'Plafond quotidien' : 'Daily cap'}</p>
                  <p className="text-xs text-muted-foreground mb-2">{isFr ? 'Au-delà, les alertes sont regroupées en digest' : 'Beyond this, alerts group into a digest'}</p>
                  <div className="flex items-center gap-2">
                    <Input type="number" min={1} max={10} className="rounded-xl h-9 w-20 text-xs text-center"
                      value={prefs.max_push_per_day}
                      onChange={(e) => { const v = Number(e.target.value); if (v >= 1 && v <= 10) updatePref('max_push_per_day', v); }} />
                    <span className="text-xs text-muted-foreground">{isFr ? 'notifications / jour' : 'notifications / day'}</span>
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
                    <div className="ml-6.5 flex items-center gap-2 text-xs">
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
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default NotificationPreferencesCard;
