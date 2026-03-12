import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Trash2, Plus, Calendar, Wallet, TrendingUp, Clock, CheckCircle2, ArrowDownLeft } from 'lucide-react';
import type { DashTranslations } from '@/i18n/dashTranslations';

interface Contribution {
  id: string;
  amount: number;
  date: string;
  account_name?: string;
  account_icon?: string;
}

interface SavingsGoalCardProps {
  goal: any;
  contributions: Contribution[];
  fmt: (n: number) => string;
  t: DashTranslations;
  locale: string;
  onAddSaving: () => void;
  onDelete: () => void;
}

export const SavingsGoalCard = ({ goal, contributions, fmt, t, locale, onAddSaving, onDelete }: SavingsGoalCardProps) => {
  const pct = goal.target_amount > 0 ? Math.min((Number(goal.current_amount) / Number(goal.target_amount)) * 100, 100) : 0;
  const done = pct >= 100;
  const remaining = Math.max(0, Number(goal.target_amount) - Number(goal.current_amount));
  const dateFmt = locale === 'fr' ? 'fr-FR' : 'en-US';

  // Calculate monthly average and estimated completion
  const monthlyAvg = contributions.length > 0 ? (() => {
    const dates = contributions.map(c => new Date(c.date).getTime());
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const months = Math.max(1, (maxDate - minDate) / (1000 * 60 * 60 * 24 * 30));
    const total = contributions.reduce((s, c) => s + c.amount, 0);
    return total / months;
  })() : 0;

  const estimatedDate = monthlyAvg > 0 && remaining > 0
    ? new Date(Date.now() + (remaining / monthlyAvg) * 30 * 24 * 60 * 60 * 1000)
    : null;

  return (
    <Card className={`border border-border/50 shadow-[var(--shadow-card)] rounded-2xl overflow-hidden ${done ? 'ring-2 ring-secondary/30' : ''}`}>
      {/* ── Header: Goal Identity ── */}
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
                  {goal.deadline
                    ? new Date(goal.deadline).toLocaleDateString(dateFmt, { day: 'numeric', month: 'short', year: 'numeric' })
                    : t.savingsNoDeadline}
                </span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onDelete}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Separator />

      {/* ── Section: Progress ── */}
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

        {/* Stats row */}
        {contributions.length > 0 && (
          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="bg-muted/50 rounded-lg p-2.5 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{t.savingsTotalContributions}</p>
              <p className="text-sm font-bold text-foreground mt-0.5">{fmt(contributions.reduce((s, c) => s + c.amount, 0))}</p>
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
                  ? `${contributions.length}`
                  : estimatedDate
                    ? estimatedDate.toLocaleDateString(dateFmt, { month: 'short', year: 'numeric' })
                    : '—'}
              </p>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* ── Section: Contribution History ── */}
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
            {contributions.slice(0, 10).map((c) => (
              <div key={c.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ArrowDownLeft className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {new Date(c.date).toLocaleDateString(dateFmt, { day: 'numeric', month: 'short' })}
                    </p>
                    {c.account_name && (
                      <p className="text-[11px] text-muted-foreground">
                        {t.savingsContributionFrom} {c.account_icon} {c.account_name}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-sm font-bold text-secondary">+{fmt(c.amount)}</span>
              </div>
            ))}
            {contributions.length > 10 && (
              <p className="text-xs text-center text-muted-foreground pt-1">
                +{contributions.length - 10} {locale === 'fr' ? 'autres' : 'more'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Footer: Action ── */}
      {!done && (
        <>
          <Separator />
          <div className="p-4">
            <Button
              onClick={onAddSaving}
              className="w-full rounded-xl text-primary-foreground"
              style={{ background: 'var(--gradient-primary)' }}
            >
              <Plus className="w-4 h-4 mr-2" />
              {t.addSaving}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
};
