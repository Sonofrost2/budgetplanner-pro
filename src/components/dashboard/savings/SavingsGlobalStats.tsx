import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { PiggyBank, Building2, TrendingUp, Wallet, Lock, Unlock, ChevronRight, CalendarDays } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { SavingsGoal } from '@/hooks/useDashboardData';
import type { DashTranslations } from '@/i18n/dashTranslations';

interface SavingsContribution {
  id: string;
  amount: number;
  date: string;
  type: string;
}

interface SavingsGlobalStatsProps {
  goals: SavingsGoal[];
  contributions: Record<string, SavingsContribution[]>;
  fmt: (n: number) => string;
  t: DashTranslations;
  locale: string;
  onCardClick?: (action: string) => void;
}

type PeriodKey = 'monthly' | 'quarterly' | 'semi_annual' | 'yearly' | 'all' | 'custom';

const getDateRangeForPeriod = (period: PeriodKey, customFrom?: Date, customTo?: Date): { start: Date; end: Date } => {
  const now = new Date();
  const end = new Date(now);
  let start: Date;

  switch (period) {
    case 'monthly':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarterly': {
      const q = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), q * 3, 1);
      break;
    }
    case 'semi_annual': {
      const s = now.getMonth() < 6 ? 0 : 6;
      start = new Date(now.getFullYear(), s, 1);
      break;
    }
    case 'yearly':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case 'custom':
      start = customFrom || new Date(now.getFullYear(), now.getMonth(), 1);
      if (customTo) end.setTime(customTo.getTime());
      return { start, end };
    default:
      start = new Date(2000, 0, 1);
  }

  return { start, end };
};

export const SavingsGlobalStats = ({ goals, contributions, fmt, t, locale, onCardClick }: SavingsGlobalStatsProps) => {
  const [period, setPeriod] = useState<PeriodKey>('monthly');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const isFr = locale === 'fr';

  const stats = useMemo(() => {
    const { start, end } = getDateRangeForPeriod(period, customFrom, customTo);

    const goalContribsInPeriod: Record<string, number> = {};
    let totalContribsInPeriod = 0;

    for (const goal of goals) {
      const contribs = contributions[goal.id] || [];
      const periodContribs = contribs
        .filter(c => {
          const d = new Date(c.date);
          return d >= start && d <= end && c.type === 'deposit';
        })
        .reduce((sum, c) => sum + Number(c.amount), 0);
      goalContribsInPeriod[goal.id] = periodContribs;
      totalContribsInPeriod += periodContribs;
    }

    const totalSaved = goals.reduce((s, g) => s + Number(g.current_amount), 0);
    const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0);
    const totalMonthlyPlanned = goals.reduce((s, g) => s + Number(g.monthly_contribution || 0), 0);
    const lockedAmount = goals.filter(g => (g as any).is_locked).reduce((s, g) => s + Number(g.current_amount), 0);
    const availableAmount = totalSaved - lockedAmount;

    const byBank: Record<string, { goals: SavingsGoal[]; totalSaved: number; totalTarget: number; monthlyPlanned: number; contribsInPeriod: number }> = {};
    for (const goal of goals) {
      const bank = (goal as any).bank_name || (locale === 'fr' ? 'Non précisé' : 'Unspecified');
      if (!byBank[bank]) byBank[bank] = { goals: [], totalSaved: 0, totalTarget: 0, monthlyPlanned: 0, contribsInPeriod: 0 };
      byBank[bank].goals.push(goal);
      byBank[bank].totalSaved += Number(goal.current_amount);
      byBank[bank].totalTarget += Number(goal.target_amount);
      byBank[bank].monthlyPlanned += Number(goal.monthly_contribution || 0);
      byBank[bank].contribsInPeriod += goalContribsInPeriod[goal.id] || 0;
    }

    return { totalSaved, totalTarget, totalMonthlyPlanned, totalContribsInPeriod, lockedAmount, availableAmount, byBank };
  }, [goals, contributions, period, customFrom, customTo, locale]);

  if (goals.length === 0) return null;

  const periodLabels: Record<PeriodKey, string> = {
    monthly: isFr ? 'Ce mois' : 'This month',
    quarterly: isFr ? 'Ce trimestre' : 'This quarter',
    semi_annual: isFr ? 'Ce semestre' : 'This semester',
    yearly: isFr ? 'Cette année' : 'This year',
    all: isFr ? 'Depuis le début' : 'All time',
    custom: isFr ? 'Personnalisé' : 'Custom',
  };

  const globalPct = stats.totalTarget > 0 ? Math.round((stats.totalSaved / stats.totalTarget) * 100) : 0;

  const clickable = !!onCardClick;
  const cardClass = clickable ? 'cursor-pointer hover:shadow-[var(--shadow-soft)] hover:-translate-y-0.5 group transition-all duration-200' : '';

  return (
    <div className="space-y-4">
      {/* Top stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className={`border-border/50 shadow-[var(--shadow-card)] rounded-2xl ${cardClass}`} onClick={() => onCardClick?.('evolution')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <PiggyBank className="w-4 h-4" />
              <span className="text-[11px] font-semibold uppercase tracking-wider flex-1">
                {isFr ? 'Épargne totale' : 'Total saved'}
              </span>
              {clickable && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />}
            </div>
            <p className="text-xl font-bold font-display">{fmt(stats.totalSaved)}</p>
            <div className="mt-2">
              <Progress value={Math.min(globalPct, 100)} className="h-1.5 rounded-full [&>div]:bg-primary" />
              <p className="text-[10px] text-muted-foreground mt-1">{globalPct}% {isFr ? 'de' : 'of'} {fmt(stats.totalTarget)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-border/50 shadow-[var(--shadow-card)] rounded-2xl ${cardClass}`} onClick={() => onCardClick?.('monthly')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-[11px] font-semibold uppercase tracking-wider flex-1">
                {isFr ? 'Mensualité prévue' : 'Monthly planned'}
              </span>
              {clickable && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />}
            </div>
            <p className="text-xl font-bold font-display">{fmt(stats.totalMonthlyPlanned)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {goals.filter(g => Number(g.monthly_contribution || 0) > 0).length} {isFr ? 'objectif(s) actif(s)' : 'active goal(s)'}
            </p>
          </CardContent>
        </Card>

        <Card className={`border-border/50 shadow-[var(--shadow-card)] rounded-2xl ${cardClass}`} onClick={() => onCardClick?.('unlocked')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Unlock className="w-4 h-4 text-secondary" />
              <span className="text-[11px] font-semibold uppercase tracking-wider flex-1">
                {isFr ? 'Disponible' : 'Available'}
              </span>
              {clickable && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />}
            </div>
            <p className="text-xl font-bold font-display text-secondary">{fmt(stats.availableAmount)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {goals.filter(g => !(g as any).is_locked).length} {isFr ? 'compte(s)' : 'account(s)'}
            </p>
          </CardContent>
        </Card>

        <Card className={`border-border/50 shadow-[var(--shadow-card)] rounded-2xl ${cardClass}`} onClick={() => onCardClick?.('locked')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Lock className="w-4 h-4 text-destructive" />
              <span className="text-[11px] font-semibold uppercase tracking-wider flex-1">
                {isFr ? 'Bloqué' : 'Locked'}
              </span>
              {clickable && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />}
            </div>
            <p className="text-xl font-bold font-display">{fmt(stats.lockedAmount)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {goals.filter(g => (g as any).is_locked).length} {isFr ? 'compte(s)' : 'account(s)'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bank breakdown with chart */}
      <Card className="border-border/50 shadow-[var(--shadow-card)] rounded-2xl">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              {isFr ? 'Répartition par banque' : 'Breakdown by bank'}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
                <SelectTrigger className="w-[160px] h-8 rounded-xl text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(periodLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {period === 'custom' && (
                <>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn('h-8 rounded-xl text-xs gap-1.5', !customFrom && 'text-muted-foreground')}>
                        <CalendarDays className="w-3.5 h-3.5" />
                        {customFrom ? format(customFrom, 'dd MMM yyyy', { locale: isFr ? fr : undefined }) : (isFr ? 'Début' : 'Start')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} initialFocus className={cn('p-3 pointer-events-auto')} />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn('h-8 rounded-xl text-xs gap-1.5', !customTo && 'text-muted-foreground')}>
                        <CalendarDays className="w-3.5 h-3.5" />
                        {customTo ? format(customTo, 'dd MMM yyyy', { locale: isFr ? fr : undefined }) : (isFr ? 'Fin' : 'End')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={customTo} onSelect={setCustomTo} initialFocus className={cn('p-3 pointer-events-auto')} />
                    </PopoverContent>
                  </Popover>
                </>
              )}
            </div>
          </div>

          {(() => {
            const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#F59E0B', '#3B82F6', '#8B5CF6', '#EF4444', '#10B981'];
            const bankEntries = Object.entries(stats.byBank).sort(([, a], [, b]) => b.totalSaved - a.totalSaved);
            const chartData = bankEntries.map(([bank, data]) => ({ name: bank, value: data.totalSaved }));

            return (
              <div className="flex flex-col md:flex-row gap-4 mb-4">
                <div className="w-full md:w-[200px] h-[200px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {chartData.map((_, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => fmt(value)}
                        contentStyle={{ borderRadius: '12px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-2 items-start content-start flex-1">
                  {bankEntries.map(([bank, data], idx) => {
                    const share = stats.totalSaved > 0 ? Math.round((data.totalSaved / stats.totalSaved) * 100) : 0;
                    return (
                      <div key={bank} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/20 border border-border/30 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[idx % COLORS.length] }} />
                        <span className="font-medium">{bank}</span>
                        <span className="text-muted-foreground">({share}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <div className="space-y-3">
            {Object.entries(stats.byBank)
              .sort(([, a], [, b]) => b.totalSaved - a.totalSaved)
              .map(([bank, data]) => {
                const pct = data.totalTarget > 0 ? Math.round((data.totalSaved / data.totalTarget) * 100) : 0;
                const shareOfTotal = stats.totalSaved > 0 ? Math.round((data.totalSaved / stats.totalSaved) * 100) : 0;
                return (
                  <div key={bank} className="p-3 rounded-xl border border-border/30 bg-muted/10 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🏦</span>
                        <div>
                          <p className="text-sm font-bold">{bank}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {data.goals.length} {isFr ? 'objectif(s)' : 'goal(s)'} · {shareOfTotal}% {isFr ? 'du total' : 'of total'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{fmt(data.totalSaved)}</p>
                        <p className="text-[10px] text-muted-foreground">{isFr ? 'sur' : 'of'} {fmt(data.totalTarget)}</p>
                      </div>
                    </div>
                    <Progress value={Math.min(pct, 100)} className="h-1.5 rounded-full [&>div]:bg-primary mb-2" />
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>
                        <Wallet className="w-3 h-3 inline mr-1" />
                        {isFr ? 'Mensualité prévue' : 'Monthly planned'}: <span className="font-semibold text-foreground">{fmt(data.monthlyPlanned)}</span>
                      </span>
                      <span>
                        {periodLabels[period]}: <span className="font-semibold text-foreground">{fmt(data.contribsInPeriod)}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
