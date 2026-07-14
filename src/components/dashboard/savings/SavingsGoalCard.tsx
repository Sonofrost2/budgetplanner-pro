import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Trash2, Plus, Calendar, Wallet, TrendingUp, Clock, CheckCircle2, ArrowDownLeft, ArrowUpRight, Pencil, CalendarClock, Lock, Unlock, Landmark, Sparkles, Coins, Archive, RotateCcw, ArrowRight } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import type { DashTranslations } from '@/i18n/dashTranslations';
import { SavingsRingProgress } from './SavingsRingProgress';

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
  onPartialWithdraw?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSimulate?: () => void;
  onCapitalizeInterest?: () => void;
  isCapitalizing?: boolean;
  onArchive?: () => void;
  onReinvest?: () => void;
  onReactivate?: () => void;
}

export const SavingsGoalCard = ({ goal, contributions, fmt, t, locale, onAddSaving, onWithdraw, onPartialWithdraw, onEdit, onDelete, onSimulate, onCapitalizeInterest, isCapitalizing, onArchive, onReinvest, onReactivate }: SavingsGoalCardProps) => {
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

    let status: 'on_track' | 'behind' | 'ahead' | 'pending' = 'on_track';

    // Goal not started yet → not "behind", just pending.
    const startDate = (goal as any).start_date ? new Date((goal as any).start_date) : null;
    const todayLocal = new Date();
    const isPending = !!(startDate && startDate > todayLocal);

    // Inside the current month, if the contribution day is in the future,
    // the user is NOT late — treat as on track.
    const cd = (goal as any).contribution_day;
    const beforeContribDay = cd && todayLocal.getDate() < Number(cd);

    if (isPending) {
      status = 'pending';
    } else if (beforeContribDay && monthlyAvg < monthlyNeeded * 0.9) {
      status = 'on_track';
    } else if (monthlyAvg > 0) {
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

  const statusColors: Record<'on_track' | 'behind' | 'ahead' | 'pending', string> = {
    on_track: 'text-secondary',
    behind: 'text-destructive',
    ahead: 'text-primary',
    pending: 'text-muted-foreground',
  };
  const statusLabels: Record<'on_track' | 'behind' | 'ahead' | 'pending', string> = {
    on_track: t.savingsOnTrack,
    behind: t.savingsBehind,
    ahead: t.savingsAhead,
    pending: locale === 'fr' ? 'À venir' : 'Upcoming',
  };

  // Severity tone for the ring
  const ringTone: 'secondary' | 'destructive' | 'primary' =
    done ? 'secondary'
      : (goal.deadline && new Date(goal.deadline) < new Date() && !done) ? 'destructive'
      : (scheduleInfo?.status === 'ahead' ? 'secondary'
         : scheduleInfo?.status === 'behind' ? 'destructive'
         : 'primary');

  // Humanized countdown
  const humanCountdown = (() => {
    if (!goal.deadline) return null;
    const now = new Date();
    const dl = new Date(goal.deadline);
    const diffDays = Math.ceil((dl.getTime() - now.getTime()) / 86400000);
    if (diffDays < 0) return locale === 'fr' ? `en retard de ${Math.abs(diffDays)} j` : `${Math.abs(diffDays)}d overdue`;
    if (diffDays === 0) return locale === 'fr' ? 'aujourd\'hui' : 'today';
    if (diffDays < 31) return locale === 'fr' ? `dans ${diffDays} j` : `in ${diffDays}d`;
    const months = Math.round(diffDays / 30);
    if (months < 12) return locale === 'fr' ? `dans ${months} mois` : `in ${months} mo`;
    const years = Math.floor(months / 12);
    return locale === 'fr' ? `dans ${years} an${years > 1 ? 's' : ''}` : `in ${years}y`;
  })();

  return (
    <Card className={`group relative border border-border/50 shadow-[var(--shadow-card)] rounded-2xl overflow-hidden glow-primary transition-all hover:shadow-[var(--shadow-soft)] hover:-translate-y-0.5 ${done ? 'ring-2 ring-secondary/30' : ''}`}>
      {/* ── Header with ring ── */}
      <div className="p-5 pb-4">
        <div className="flex items-start gap-4">
          <SavingsRingProgress value={pct} size={84} strokeWidth={7} tone={ringTone}>
            <div className="text-center">
              <span className="text-2xl">{goal.icon}</span>
              <p className="text-[10px] font-bold leading-none mt-0.5">{Math.round(pct)}%</p>
            </div>
          </SavingsRingProgress>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-foreground truncate">{goal.name}</h3>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground flex-wrap">
                  {(goal as any).is_locked ? (
                    <span className="flex items-center gap-1 text-destructive font-medium">
                      <Lock className="w-3 h-3" />{t.savingsLocked}
                    </span>
                  ) : Number(goal.current_amount) > 0 ? (
                    <span className="flex items-center gap-1 text-secondary font-medium">
                      <Unlock className="w-3 h-3" />{t.savingsAvailable}
                    </span>
                  ) : null}
                  {(goal as any).bank_name && (
                    <span className="flex items-center gap-1">
                      <Landmark className="w-3 h-3" />{(goal as any).bank_name}
                    </span>
                  )}
                  {Number((goal as any).interest_rate) > 0 && (
                    <span className="flex items-center gap-1 text-primary font-medium">
                      <TrendingUp className="w-3 h-3" />{(goal as any).interest_rate}%
                    </span>
                  )}
                  {humanCountdown && (
                    <span className="flex items-center gap-1">
                      <CalendarClock className="w-3 h-3" />{humanCountdown}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                <Button aria-label="Modifier" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={onEdit}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button aria-label="Supprimer" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onDelete}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            <div className="mt-3 space-y-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xl font-bold text-foreground amount-display">{fmt(Number(goal.current_amount))}</span>
                <span className="text-xs text-muted-foreground">/ {fmt(Number(goal.target_amount))}</span>
                {done && (
                  <span className="ml-auto text-[10px] font-bold text-secondary flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />{t.savingsGoalCompleted}
                  </span>
                )}
              </div>
              {!done && (
                <p className="text-[11px] text-muted-foreground">
                  {t.savingsRemaining}: <span className="font-semibold text-foreground">{fmt(remaining)}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {deposits.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="bg-muted/40 rounded-lg p-2 text-center">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">{t.savingsTotalContributions}</p>
              <p className="text-xs font-bold text-foreground mt-0.5 amount-display">{fmt(deposits.reduce((s, c) => s + c.amount, 0))}</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-2 text-center">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">{t.savingsMonthlyAvg}</p>
              <p className="text-xs font-bold text-foreground mt-0.5 amount-display">{fmt(monthlyAvg)}</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-2 text-center">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">
                {done ? t.savingsContributionCount : t.savingsEstimatedDate}
              </p>
              <p className="text-xs font-bold text-foreground mt-0.5">
                {done ? `${deposits.length}` : estimatedDate ? estimatedDate.toLocaleDateString(dateFmt, { month: 'short', year: '2-digit' }) : '—'}
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
      <div className="p-4 flex gap-2 flex-wrap">
        {!done && (goal as any).status !== 'completed' && (
          <Button onClick={onAddSaving} className="flex-1 rounded-xl text-primary-foreground" style={{ background: 'var(--gradient-primary)' }}>
            <Plus className="w-4 h-4 mr-2" />{t.addSaving}
          </Button>
        )}
        {Number(goal.current_amount) > 0 && !(goal as any).is_locked && (goal as any).status !== 'completed' && (
          <Button onClick={onWithdraw} variant="outline" className="flex-1 rounded-xl">
            <ArrowUpRight className="w-4 h-4 mr-2" />{t.withdrawSaving}
          </Button>
        )}
        {onPartialWithdraw && Number(goal.current_amount) > 0 && !(goal as any).is_locked && (goal as any).status !== 'completed' && (
          <Button onClick={onPartialWithdraw} variant="outline" className="rounded-xl" size="sm" title={locale === 'fr' ? 'Retrait partiel' : 'Partial withdraw'}>
            <ArrowUpRight className="w-4 h-4 mr-1.5" />
            <span className="text-xs">{locale === 'fr' ? 'Partiel' : 'Partial'}</span>
          </Button>
        )}
        {Number(goal.current_amount) > 0 && (goal as any).is_locked && (goal as any).status !== 'completed' && (
          <Button variant="outline" className="flex-1 rounded-xl opacity-50 cursor-not-allowed" disabled>
            <Lock className="w-4 h-4 mr-2" />{t.savingsLocked}
          </Button>
        )}
        {onCapitalizeInterest && (goal as any).status !== 'completed' && (
          <Button onClick={onCapitalizeInterest} variant="outline" className="rounded-xl" size="sm" disabled={isCapitalizing}
            title={t.capitalizeInterest}>
            <Coins className={`w-4 h-4 mr-1.5 text-amber-500 ${isCapitalizing ? 'animate-spin' : ''}`} />
            <span className="text-xs">{isCapitalizing ? t.capitalizingInterest : t.capitalizeInterest}</span>
          </Button>
        )}
        {onArchive && (
          <Button onClick={onArchive} variant="outline" className="rounded-xl" size="sm" title={t.archiveGoal}>
            <Archive className="w-4 h-4 mr-1.5 text-secondary" />
            <span className="text-xs">{t.archiveGoal}</span>
          </Button>
        )}
        {onReinvest && (
          <Button onClick={onReinvest} className="flex-1 rounded-xl text-primary-foreground" style={{ background: 'var(--gradient-primary)' }}>
            <ArrowRight className="w-4 h-4 mr-2" />{t.reinvestGoal}
          </Button>
        )}
        {onReactivate && (
          <Button onClick={onReactivate} variant="outline" className="flex-1 rounded-xl">
            <RotateCcw className="w-4 h-4 mr-2" />{t.reactivateGoal}
          </Button>
        )}
        {onSimulate && (goal as any).status !== 'completed' && (
          <Button aria-label="Suggestions IA" onClick={onSimulate} variant="outline" className="rounded-xl" size="icon" title={t.simulateAI}>
            <Sparkles className="w-4 h-4 text-primary" />
          </Button>
        )}
      </div>
    </Card>
  );
};
