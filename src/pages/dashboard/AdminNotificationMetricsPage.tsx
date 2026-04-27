import { useEffect, useMemo, useState } from 'react';
import { useRole } from '@/hooks/useRole';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HeroHeaderShell } from '@/components/dashboard/HeroHeaderShell';
import { Activity, RefreshCw, AlertTriangle, Send, Clock, CheckCircle2, XCircle, Sparkles, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
} from 'recharts';

type Row = {
  day: string;
  channel: string;
  sent_count: number;
  queued_pending: number;
  queued_sent: number;
  queued_failed: number;
  queued_cancelled: number;
  auto_resolved_count: number;
  cancelled_alerts_total: number;
};

const CHANNELS = ['push', 'email', 'sms', 'whatsapp'] as const;
const CHANNEL_COLORS: Record<string, string> = {
  push: 'hsl(var(--primary))',
  email: 'hsl(var(--accent))',
  sms: '#10b981',
  whatsapp: '#22c55e',
};

const AdminNotificationMetricsPage = () => {
  const { isAdmin, loading: roleLoading } = useRole();
  const { locale } = useLanguage();
  const isFr = locale === 'fr';

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<7 | 14 | 30>(14);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_notification_metrics', { days_back: range });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data as Row[]) || []);
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, range]);

  // KPIs over the period
  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.sent += r.sent_count;
        acc.pending += r.queued_pending;
        acc.failed += r.queued_failed;
        acc.resolved += r.auto_resolved_count;
        acc.cancelled += r.cancelled_alerts_total;
        return acc;
      },
      { sent: 0, pending: 0, failed: 0, resolved: 0, cancelled: 0 }
    );
  }, [rows]);

  // Per-channel breakdown
  const perChannel = useMemo(() => {
    const map: Record<string, number> = {};
    rows.forEach(r => {
      map[r.channel] = (map[r.channel] || 0) + r.sent_count;
    });
    return CHANNELS.map(ch => ({ channel: ch, count: map[ch] || 0 }));
  }, [rows]);

  // Time series (per day, summed across channels)
  const series = useMemo(() => {
    const byDay = new Map<string, { day: string; sent: number; failed: number; resolved: number }>();
    rows.forEach(r => {
      const k = r.day;
      if (!byDay.has(k)) byDay.set(k, { day: k, sent: 0, failed: 0, resolved: 0 });
      const e = byDay.get(k)!;
      e.sent += r.sent_count;
      e.failed += r.queued_failed;
      e.resolved += r.auto_resolved_count;
    });
    return Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day));
  }, [rows]);

  // Time series per channel (sent only) for stacked view
  const channelSeries = useMemo(() => {
    const byDay = new Map<string, Record<string, number | string>>();
    rows.forEach(r => {
      if (!byDay.has(r.day)) byDay.set(r.day, { day: r.day });
      const e = byDay.get(r.day)!;
      e[r.channel] = (Number(e[r.channel] || 0) + r.sent_count);
    });
    return Array.from(byDay.values()).sort((a, b) => String(a.day).localeCompare(String(b.day)));
  }, [rows]);

  const fmtDay = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { day: '2-digit', month: 'short' });
  };

  if (roleLoading) {
    return <div className="p-6 text-sm text-muted-foreground">{isFr ? 'Chargement…' : 'Loading…'}</div>;
  }
  if (!isAdmin) {
    return (
      <Card className="rounded-2xl glass border-destructive/30 max-w-xl mx-auto mt-8">
        <CardContent className="p-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">{isFr ? 'Accès réservé aux administrateurs' : 'Admins only'}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {isFr ? 'Cette page nécessite le rôle administrateur.' : 'This page requires the admin role.'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <HeroHeaderShell topBlobClassName="bg-primary/25" bottomBlobClassName="bg-accent/15">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--gradient-primary)' }}>
            <Activity className="w-7 h-7 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Admin</span>
            <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight">
              {isFr ? 'Métriques notifications' : 'Notification metrics'}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isFr
                ? 'Pilotage du Coach intelligent : envoyés, différés, auto-résolus par canal'
                : 'Intelligent Coach pulse: sent, deferred, auto-resolved per channel'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(range)} onValueChange={v => setRange(Number(v) as 7 | 14 | 30)}>
              <SelectTrigger className="rounded-xl h-9 text-xs w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">{isFr ? '7 jours' : '7 days'}</SelectItem>
                <SelectItem value="14">{isFr ? '14 jours' : '14 days'}</SelectItem>
                <SelectItem value="30">{isFr ? '30 jours' : '30 days'}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={load} disabled={loading} className="rounded-xl">
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              {isFr ? 'Rafraîchir' : 'Refresh'}
            </Button>
          </div>
        </div>
      </HeroHeaderShell>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard icon={Send} tone="primary" label={isFr ? 'Envoyés' : 'Sent'} value={totals.sent} />
        <KpiCard icon={Clock} tone="warning" label={isFr ? 'En attente' : 'Pending'} value={totals.pending} />
        <KpiCard icon={XCircle} tone="destructive" label={isFr ? 'Échecs' : 'Failed'} value={totals.failed} />
        <KpiCard icon={Sparkles} tone="accent" label={isFr ? 'Auto-résolus' : 'Auto-resolved'} value={totals.resolved} />
        <KpiCard icon={CheckCircle2} tone="success" label={isFr ? 'Alertes annulées' : 'Alerts cancelled'} value={totals.cancelled} />
      </div>

      {/* Trend chart: sent vs failed vs auto-resolved */}
      <Card className="rounded-2xl glass border-border/50">
        <CardContent className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
            {isFr ? 'Tendance quotidienne' : 'Daily trend'}
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="day" tickFormatter={fmtDay} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <RTooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                  labelFormatter={(v) => fmtDay(String(v))}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="sent" name={isFr ? 'Envoyés' : 'Sent'} stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="failed" name={isFr ? 'Échecs' : 'Failed'} stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="resolved" name={isFr ? 'Auto-résolus' : 'Auto-resolved'} stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Per-channel breakdown */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="rounded-2xl glass border-border/50">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
              {isFr ? 'Envois par canal' : 'Sends per channel'}
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perChannel}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="channel" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <RTooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl glass border-border/50">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
              {isFr ? 'Volumétrie multi-canal' : 'Multi-channel volume'}
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={channelSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="day" tickFormatter={(v) => fmtDay(String(v))} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <RTooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                    labelFormatter={(v) => fmtDay(String(v))}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  {CHANNELS.map(ch => (
                    <Bar key={ch} dataKey={ch} stackId="a" fill={CHANNEL_COLORS[ch]} radius={[0, 0, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Empty state */}
      {!loading && rows.every(r => r.sent_count + r.queued_pending + r.queued_failed + r.auto_resolved_count === 0) && (
        <Card className="rounded-2xl glass border-border/50">
          <CardContent className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
            <Inbox className="w-8 h-8 opacity-40" />
            {isFr
              ? "Aucune activité notifications sur la période. Les métriques apparaîtront après les premiers envois."
              : 'No notification activity in this period. Metrics will appear after the first sends.'}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const KpiCard = ({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: 'primary' | 'accent' | 'warning' | 'destructive' | 'success';
}) => {
  const toneClass: Record<string, string> = {
    primary: 'text-primary',
    accent: 'text-accent',
    warning: 'text-amber-600 dark:text-amber-400',
    destructive: 'text-destructive',
    success: 'text-emerald-600 dark:text-emerald-400',
  };
  return (
    <Card className="rounded-2xl glass border-border/50">
      <CardContent className="p-4">
        <div className={`flex items-center gap-2 ${toneClass[tone]}`}>
          <Icon className="w-3.5 h-3.5" />
          <p className="text-[10px] font-bold uppercase tracking-wider">{label}</p>
        </div>
        <p className="text-2xl font-bold font-display mt-1">{value.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
};

export default AdminNotificationMetricsPage;