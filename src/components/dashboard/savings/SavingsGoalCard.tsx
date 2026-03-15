import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Trash2, Plus, Calendar, Wallet, TrendingUp, Clock, CheckCircle2, ArrowDownLeft, ArrowUpRight, Pencil, CalendarClock, Lock, Unlock, Landmark, Sparkles } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import type { DashTranslations } from '@/i18n/dashTranslations';

interface Contribution {
  id: string;
  amount: number;
  date: string;
  type: 'deposit' | 'withdrawal';
  account_name?: string;
  account_icon?: string;
}

import type { SavingsGoal } from '@/hooks/useDashboardData';

interface SavingsGoalCardProps {
  goal: SavingsGoal;
  contributions: Contribution[];
  fmt: (n: number) => string;
  t: DashTranslations;
  locale: string;
  onAddSaving: () => void;
  onWithdraw: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSimulate?: () => void;
}

export const SavingsGoalCard = ({ goal, contributions, fmt, t, locale, onAddSaving, onWithdraw, onEdit, onDelete }: SavingsGoalCardProps) => {
  const pct = goal.target_amount > 0 ? Math.min((Number(goal.current_amount) / Number(goal.target_amount)) * 100, 100) : 0;
  const done = pct >= 100;
  const remaining = Math.max(0, Number(goal.target_amount) - Number(goal.current_amount));
  const dateFmt = locale === 'fr' ? 'fr-FR' : 'en-US';

  const deposits = contributions.filter(c => c.type === 'deposit');

  const monthlyAvg = deposits.length > 0 ? (() => {
    const dates = deposits.map(c => new Date(c.date).getTime());
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const months = Math.max(1, (maxDate - minDate) / (1000 * 60 * 60 * 24 * 30));
    const total = deposits.reduce((s, c) => s + c.amount, 0);
    return total / months;
  })() : 0;

  const estimatedDate = monthlyAvg > 0 && remaining > 0
    ? new Date(Date.now() + (remaining / monthlyAvg) * 30 * 24 * 60 * 60 * 1000)
    : null;

  // Monthly schedule calculation
  const scheduleInfo = (() => {
    // Use explicit monthly_contribution if set
    const explicitMonthly = Number(goal.monthly_contribution) || 0;
    if (done) return null;
    
    let monthlyNeeded = explicitMonthly;
    let monthsLeft: number | null = null;

    if (goal.deadline) {
      const deadlineDate = new Date(goal.deadline);
      const now = new Date();
      const msLeft = deadlineDate.getTime() - now.getTime();
      monthsLeft = Math.max(1, Math.ceil(msLeft / (1000 * 60 * 60 * 24 * 30)));
      if (monthlyNeeded <= 0) {
        monthlyNeeded = remaining / monthsLeft;
      }
    }

    if (monthlyNeeded <= 0) return null;

    let status: 'on_track' | 'behind' | 'ahead' = 'on_track';
    if (monthlyAvg > 0) {
      if (monthlyAvg >= monthlyNeeded * 1.1) status = 'ahead';
      else if (monthlyAvg < monthlyNeeded * 0.9) status = 'behind';
    }
    return { monthsLeft, monthlyNeeded, status };
  })();

  // Build evolution chart data
  const chartData = (() => {
    if (contributions.length === 0) return [];
    const sorted = [...contributions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let cumul = 0;
    return sorted.map(c => {
      cumul += c.type === 'deposit' ? c.amount : -c.amount;
      return {
        date: new Date(c.date).toLocaleDateString(dateFmt, { day: 'numeric', month: 'short' }),
        total: Math.max(0, cumul),
      };
    });
  })();

  const statusColors = {
    on_track: 'text-secondary',
    behind: 'text-destructive',
    ahead: 'text-primary',
  };
  const statusLabels = {
    on_track: t.savingsOnTrack,
    behind: t.savingsBehind,
    ahead: t.savingsAhead,
  };

  return (
    <Card className={`border border-border/50 shadow-[var(--shadow-card)] rounded-2xl overflow-hidden ${done ? 'ring-2 ring-secondary/30' : ''}`}>
      {/* ── Header ── */}
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">
              {goal.icon}
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">{goal.name}</h3>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                {goal.payment_accounts && (
                  <span className="flex items-center gap-1">
                    <Wallet className="w-3 h-3" />
                    {goal.payment_accounts.icon} {goal.payment_accounts.name}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {goal.start_date
                    ? new Date(goal.start_date).toLocaleDateString(dateFmt, { day: 'numeric', month: 'short', year: 'numeric' })
                    : locale === 'fr' ? 'Pas de début' : 'No start'}
                  {' → '}
                  {goal.deadline
                    ? new Date(goal.deadline).toLocaleDateString(dateFmt, { day: 'numeric', month: 'short', year: 'numeric' })
                    : t.savingsNoDeadline}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={onEdit}>
              <Pencil className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onDelete}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      {/* ── Progress ── */}
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            {t.savingsProgressTitle}
          </span>
          {done && (
            <span className="text-xs font-bold text-secondary flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {t.savingsGoalCompleted}
            </span>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <span className="text-2xl font-bold text-foreground">{fmt(Number(goal.current_amount))}</span>
            <span className="text-sm text-muted-foreground">{fmt(Number(goal.target_amount))}</span>
          </div>
          <Progress value={pct} className={`h-3 rounded-full ${done ? '[&>div]:bg-secondary' : '[&>div]:bg-primary'}`} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="font-semibold">{pct.toFixed(0)}%</span>
            {!done && <span>{t.savingsRemaining}: {fmt(remaining)}</span>}
          </div>
        </div>

        {deposits.length > 0 && (
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="bg-muted/50 rounded-lg p-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{t.savingsTotalContributions}</p>
              <p className="text-sm font-bold text-foreground mt-0.5">{fmt(deposits.reduce((s, c) => s + c.amount, 0))}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{t.savingsMonthlyAvg}</p>
              <p className="text-sm font-bold text-foreground mt-0.5">{fmt(monthlyAvg)}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {done ? t.savingsContributionCount : t.savingsEstimatedDate}
              </p>
              <p className="text-sm font-bold text-foreground mt-0.5">
                {done
                  ? `${deposits.length}`
                  : estimatedDate
                    ? estimatedDate.toLocaleDateString(dateFmt, { month: 'short', year: 'numeric' })
                    : '—'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Monthly Schedule ── */}
      {scheduleInfo && !done && (
        <>
          <Separator />
          <div className="px-5 py-4 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5" />
              {t.savingsMonthlySchedule}
            </span>
            <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
              <div>
                <p className="text-sm font-bold text-foreground">{fmt(scheduleInfo.monthlyNeeded)}<span className="text-xs font-normal text-muted-foreground"> / {locale === 'fr' ? 'mois' : 'mo'}</span></p>
                <p className="text-xs text-muted-foreground">{scheduleInfo.monthsLeft !== null ? `${scheduleInfo.monthsLeft} ${t.savingsMonthsLeft}` : ''}</p>
              </div>
              <span className={`text-xs font-bold ${statusColors[scheduleInfo.status]}`}>
                {statusLabels[scheduleInfo.status]}
              </span>
            </div>
          </div>
        </>
      )}

      {/* ── Evolution Chart ── */}
      {chartData.length >= 2 && (
        <>
          <Separator />
          <div className="px-5 py-4 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              {t.savingsEvolution}
            </span>
            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                  <defs>
                    <linearGradient id={`grad-${goal.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                    formatter={(value: number) => [fmt(value), locale === 'fr' ? 'Épargné' : 'Saved']}
                  />
                  <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} fill={`url(#grad-${goal.id})`} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      <Separator />

      {/* ── Contribution History ── */}
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {t.savingsContributions}
          </span>
          <span className="text-xs text-muted-foreground">
            {contributions.length} {t.savingsContributionCount}
          </span>
        </div>

        {contributions.length === 0 ? (
          <p className="text-sm text-muted-foreground/70 text-center py-3">{t.savingsNoContributions}</p>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {contributions.slice(0, 10).map((c) => {
              const isWithdrawal = c.type === 'withdrawal';
              return (
                <div key={c.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isWithdrawal ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                      {isWithdrawal ? <ArrowUpRight className="w-3.5 h-3.5 text-destructive" /> : <ArrowDownLeft className="w-3.5 h-3.5 text-primary" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {new Date(c.date).toLocaleDateString(dateFmt, { day: 'numeric', month: 'short' })}
                      </p>
                      {c.account_name && (
                        <p className="text-[11px] text-muted-foreground">
                          {isWithdrawal ? '→' : t.savingsContributionFrom} {c.account_icon} {c.account_name}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={`text-sm font-bold ${isWithdrawal ? 'text-destructive' : 'text-secondary'}`}>
                    {isWithdrawal ? '-' : '+'}{fmt(c.amount)}
                  </span>
                </div>
              );
            })}
            {contributions.length > 10 && (
              <p className="text-xs text-center text-muted-foreground pt-1">
                +{contributions.length - 10} {locale === 'fr' ? 'autres' : 'more'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <Separator />
      <div className="p-4 flex gap-2">
        {!done && (
          <Button onClick={onAddSaving} className="flex-1 rounded-xl text-primary-foreground" style={{ background: 'var(--gradient-primary)' }}>
            <Plus className="w-4 h-4 mr-2" />{t.addSaving}
          </Button>
        )}
        {Number(goal.current_amount) > 0 && (
          <Button onClick={onWithdraw} variant="outline" className="flex-1 rounded-xl">
            <ArrowUpRight className="w-4 h-4 mr-2" />{t.withdrawSaving}
          </Button>
        )}
      </div>
    </Card>
  );
};
