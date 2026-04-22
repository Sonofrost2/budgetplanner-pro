import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Bell, AlertTriangle, CheckCircle2, Calendar, PiggyBank, Clock, RotateCcw, Wand2 } from 'lucide-react';
import NotificationPreferencesCard from '@/components/dashboard/settings/NotificationPreferencesCard';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import {
  inQuietHours,
  shouldFireUpcoming,
  shouldFireDeadline,
  formatDaysLeftLabel,
  type CadencePrefs,
} from '@/lib/notificationCadence';

/* ───────── Mock fixtures: stable, illustrative, no DB hit ───────── */
type MockNotif = {
  id: string;
  icon: React.ReactNode;
  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  daysLeft: number;
  prefKey?: keyof CadencePrefs; // pref required to show this notif
  upcoming?: boolean;
  kind: 'budget' | 'savings' | 'recurring' | 'discrepancy' | 'goal';
};

const buildMocks = (isFr: boolean): MockNotif[] => [
  {
    id: 'm1', kind: 'budget', severity: 'critical', daysLeft: 0, prefKey: 'budget_alerts',
    icon: <AlertTriangle className="w-4 h-4 text-destructive" />,
    title: isFr ? 'Budget dépassé' : 'Budget exceeded',
    message: isFr ? '🍔 Restaurants : 112% — +6 700' : '🍔 Restaurants: 112% — +6,700',
  },
  {
    id: 'm2', kind: 'budget', severity: 'warning', daysLeft: 0, prefKey: 'budget_alerts',
    icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
    title: isFr ? 'Budget à 85%' : 'Budget at 85%',
    message: isFr ? '🛒 Courses : seuil atteint (80%)' : '🛒 Groceries: threshold reached (80%)',
  },
  {
    id: 'm3', kind: 'budget', severity: 'info', daysLeft: 5, prefKey: 'budget_projections', upcoming: true,
    icon: <Calendar className="w-4 h-4 text-primary" />,
    title: isFr ? '📅 Loyer — dans 5 jours' : '📅 Rent — in 5 days',
    message: isFr ? '🏠 Échéance prévue : 250 000' : '🏠 Upcoming deadline: 250,000',
  },
  {
    id: 'm4', kind: 'savings', severity: 'info', daysLeft: 2, prefKey: 'savings_reminders', upcoming: true,
    icon: <PiggyBank className="w-4 h-4 text-emerald-500" />,
    title: isFr ? '🐷 Cotisation dans 2j' : '🐷 Contribution in 2d',
    message: isFr ? '🏖️ Vacances : 50 000' : '🏖️ Vacation: 50,000',
  },
  {
    id: 'm5', kind: 'goal', severity: 'success', daysLeft: 0, prefKey: 'goal_reached',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
    title: isFr ? '🎉 Objectif atteint' : '🎉 Goal reached',
    message: isFr ? '💻 Nouveau MacBook' : '💻 New MacBook',
  },
  {
    id: 'm6', kind: 'recurring', severity: 'info', daysLeft: 0, prefKey: 'recurring_reminders',
    icon: <RotateCcw className="w-4 h-4 text-purple-500" />,
    title: isFr ? "📋 Échéance aujourd'hui" : '📋 Due today',
    message: isFr ? 'Netflix : 4 990 (dépense)' : 'Netflix: 4,990 (expense)',
  },
  {
    id: 'm7', kind: 'discrepancy', severity: 'warning', daysLeft: 0, prefKey: 'balance_discrepancy',
    icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
    title: isFr ? 'Écart de solde' : 'Balance discrepancy',
    message: isFr ? '💳 Wave : -2 350 vs théorique' : '💳 Wave: -2,350 vs calculated',
  },
];

const sevColor = {
  critical: 'border-l-destructive bg-destructive/5',
  warning: 'border-l-amber-500 bg-amber-500/5',
  info: 'border-l-primary bg-primary/5',
  success: 'border-l-emerald-500 bg-emerald-500/5',
};

const NotificationsPage = () => {
  const { locale } = useLanguage();
  const isFr = locale === 'fr';
  const { prefs, loading } = useNotificationPreferences();

  // Simulated clock for the preview (defaults to "now")
  const [simHour, setSimHour] = useState<number>(new Date().getHours());

  const mocks = useMemo(() => buildMocks(isFr), [isFr]);

  const simulatedNow = useMemo(() => {
    const d = new Date();
    d.setHours(simHour, 0, 0, 0);
    return d;
  }, [simHour]);

  const cadencePrefs: CadencePrefs = {
    quiet_hours_enabled: prefs.quiet_hours_enabled,
    quiet_hours_start: prefs.quiet_hours_start,
    quiet_hours_end: prefs.quiet_hours_end,
    status_reminder_frequency: prefs.status_reminder_frequency,
    budget_alerts: prefs.budget_alerts,
    budget_projections: prefs.budget_projections,
    savings_reminders: prefs.savings_reminders,
    recurring_reminders: prefs.recurring_reminders,
    balance_discrepancy: prefs.balance_discrepancy,
    goal_reached: prefs.goal_reached,
  };

  const quiet = inQuietHours(simulatedNow, cadencePrefs);

  /* Apply the same cadence rules as the bell does to the mock data. */
  const visible = useMemo(() => {
    if (quiet) return [];
    return mocks.filter(n => {
      // Per-type pref toggle
      if (n.prefKey && (cadencePrefs as any)[n.prefKey] === false) return false;
      // Upcoming items honor J-5/2/0 (or J-30/7/2/0 for deadlines)
      if (n.upcoming) {
        const ok = n.kind === 'savings' && n.daysLeft >= 7
          ? shouldFireDeadline(n.daysLeft)
          : shouldFireUpcoming(n.daysLeft);
        if (!ok) return false;
      }
      return true;
    }).sort((a, b) => {
      const sevRank = { critical: 0, warning: 1, info: 2, success: 3 };
      if (sevRank[a.severity] !== sevRank[b.severity]) return sevRank[a.severity] - sevRank[b.severity];
      return a.daysLeft - b.daysLeft;
    });
  }, [quiet, mocks, cadencePrefs]);

  const today = visible.filter(n => !n.upcoming);
  const upcoming = visible.filter(n => n.upcoming);

  useEffect(() => {
    document.title = isFr ? 'Notifications · Budget Planner' : 'Notifications · Budget Planner';
  }, [isFr]);

  return (
    <div className="space-y-6 p-1">
      <header className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Bell className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">{isFr ? 'Notifications' : 'Notifications'}</h1>
          <p className="text-sm text-muted-foreground">
            {isFr
              ? 'Règle ta cadence et vois immédiatement le résultat dans la cloche.'
              : 'Tune your cadence and see the bell update instantly.'}
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        {/* Left — preferences */}
        <div className="space-y-6 min-w-0">
          <NotificationPreferencesCard locale={locale} />
        </div>

        {/* Right — live simulator */}
        <aside className="space-y-4 min-w-0">
          <Card className="border-none shadow-[var(--shadow-card)] sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-primary" />
                {isFr ? 'Aperçu de la cloche' : 'Bell preview'}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {isFr
                  ? 'Données fictives — reflète tes réglages en temps réel.'
                  : 'Mock data — reflects your settings live.'}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Simulated clock */}
              <div className="rounded-xl border border-border/50 bg-muted/30 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <Label className="text-xs font-medium">
                    {isFr ? 'Heure simulée' : 'Simulated hour'}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="range"
                    min={0}
                    max={23}
                    value={simHour}
                    onChange={(e) => setSimHour(Number(e.target.value))}
                    className="flex-1 h-2 accent-primary"
                  />
                  <span className="text-sm font-mono w-12 text-right tabular-nums">
                    {String(simHour).padStart(2, '0')}h
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {isFr
                    ? 'Bouge le curseur pour tester les heures silencieuses.'
                    : 'Drag to test quiet hours.'}
                </p>
              </div>

              {loading ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  {isFr ? 'Chargement…' : 'Loading…'}
                </div>
              ) : quiet ? (
                <div className="rounded-xl border border-indigo-400/30 bg-indigo-500/5 p-4 text-center space-y-1">
                  <p className="text-2xl">🌙</p>
                  <p className="text-sm font-medium">
                    {isFr ? 'Heures silencieuses actives' : 'Quiet hours active'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isFr
                      ? `Aucune notification entre ${prefs.quiet_hours_start}h et ${prefs.quiet_hours_end}h.`
                      : `No notifications between ${prefs.quiet_hours_start}:00 and ${prefs.quiet_hours_end}:00.`}
                  </p>
                </div>
              ) : (
                <Tabs defaultValue="today" className="w-full">
                  <TabsList className="w-full grid grid-cols-2 h-9">
                    <TabsTrigger value="today" className="text-xs gap-1.5">
                      {isFr ? "Aujourd'hui" : 'Today'}
                      <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{today.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="upcoming" className="text-xs gap-1.5">
                      {isFr ? 'À venir' : 'Upcoming'}
                      <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{upcoming.length}</Badge>
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="today" className="mt-3 space-y-2">
                    {today.length === 0 ? (
                      <EmptyHint isFr={isFr} />
                    ) : today.map(n => <PreviewItem key={n.id} n={n} isFr={isFr} locale={locale} />)}
                  </TabsContent>
                  <TabsContent value="upcoming" className="mt-3 space-y-2">
                    {upcoming.length === 0 ? (
                      <EmptyHint isFr={isFr} />
                    ) : upcoming.map(n => <PreviewItem key={n.id} n={n} isFr={isFr} locale={locale} />)}
                  </TabsContent>
                </Tabs>
              )}

              <Separator />
              <div className="text-[11px] text-muted-foreground space-y-1">
                <p className="font-medium text-foreground/80">{isFr ? 'Tester rapidement :' : 'Quick tests:'}</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>{isFr ? 'Désactive « Alertes de budget » → 2 cartes disparaissent.' : 'Disable "Budget alerts" → 2 cards vanish.'}</li>
                  <li>{isFr ? 'Glisse l\'heure dans la fenêtre silencieuse.' : 'Slide the hour into the quiet window.'}</li>
                  <li>{isFr ? '« Seulement si ça change » : seuls les changements de palier 10pt déclenchent.' : '"Only when status changes": only 10pt bucket shifts fire.'}</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
};

const EmptyHint = ({ isFr }: { isFr: boolean }) => (
  <div className="text-center py-6 text-xs text-muted-foreground">
    {isFr ? 'Rien à afficher avec ces réglages 🎉' : 'Nothing to show with these settings 🎉'}
  </div>
);

const PreviewItem = ({ n, isFr, locale }: { n: MockNotif; isFr: boolean; locale: string }) => (
  <div className={`rounded-xl border-l-2 ${sevColor[n.severity]} px-3 py-2.5`}>
    <div className="flex items-start gap-2">
      <div className="mt-0.5">{n.icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold leading-tight">{n.title}</p>
        <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 truncate">{n.message}</p>
        {n.upcoming && (
          <p className="text-[10px] text-primary/80 mt-1">
            {formatDaysLeftLabel(n.daysLeft, locale)}
          </p>
        )}
      </div>
    </div>
  </div>
);

export default NotificationsPage;
