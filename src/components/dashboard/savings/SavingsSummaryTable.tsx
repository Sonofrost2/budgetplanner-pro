import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import type { DashTranslations } from '@/i18n/dashTranslations';

import type { SavingsGoal } from '@/hooks/useDashboardData';
import { isLiveGoal } from '@/lib/savingsLogic';

interface SavingsContribution {
  id: string;
  amount: number;
  date: string;
  type: string;
}

interface SavingsSummaryTableProps {
  goals: SavingsGoal[];
  contributions: Record<string, SavingsContribution[]>;
  fmt: (n: number) => string;
  t: DashTranslations;
  locale: string;
}

const getStatus = (goal: SavingsGoal): 'completed' | 'late' | 'inProgress' => {
  if (Number(goal.current_amount) >= Number(goal.target_amount)) return 'completed';
  if (goal.deadline) {
    const now = new Date();
    const dl = new Date(goal.deadline);
    if (dl < now) return 'late';
  }
  return 'inProgress';
};

/**
 * E2 — Mensualité nécessaire pour atteindre la cible :
 * on part TOUJOURS de "maintenant" (pas de start_date), sinon la valeur
 * ne diminue jamais au fil du temps. Si une mensualité explicite est
 * définie ET est suffisante, on l'affiche telle quelle ; sinon on
 * affiche la mensualité réellement requise pour tenir la deadline.
 */
const getMonthlyNeeded = (goal: any): number | null => {
  const remaining = Number(goal.target_amount) - Number(goal.current_amount);
  if (remaining <= 0) return 0;
  if (!goal.deadline) {
    return Number(goal.monthly_contribution) > 0 ? Number(goal.monthly_contribution) : null;
  }
  const now = new Date();
  const dl = new Date(goal.deadline);
  const monthsLeft = Math.max(
    1,
    (dl.getFullYear() - now.getFullYear()) * 12 + (dl.getMonth() - now.getMonth()),
  );
  return remaining / monthsLeft;
};

export const SavingsSummaryTable = ({ goals, contributions, fmt, t, locale }: SavingsSummaryTableProps) => {
  // E1 — même base que le hero et les 4 KPI cards
  const liveGoals = goals.filter(isLiveGoal);
  if (liveGoals.length === 0) return null;

  const totalCurrent = liveGoals.reduce((s, g) => s + Number(g.current_amount), 0);
  const totalTarget = liveGoals.reduce((s, g) => s + Number(g.target_amount), 0);
  const totalPct = totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0;

  const statusConfig = {
    completed: { label: t.savingsCompleted, variant: 'default' as const, className: 'bg-secondary text-secondary-foreground' },
    late: { label: t.savingsLate, variant: 'destructive' as const, className: '' },
    inProgress: { label: t.savingsInProgress, variant: 'default' as const, className: 'bg-primary/15 text-primary border-primary/20' },
  };

  return (
    <div className="rounded-2xl border border-border/50 shadow-[var(--shadow-card)] bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border/50 sticky top-0 bg-card z-10">
        <h3 className="text-base font-bold flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-secondary/10 flex items-center justify-center text-sm">📊</span>
          {t.savingsSummary}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-muted/40 backdrop-blur z-[5]">
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>{locale === 'fr' ? 'Objectif' : 'Goal'}</TableHead>
              <TableHead className="min-w-[140px]">{t.progress}</TableHead>
              <TableHead className="text-right">{t.amount}</TableHead>
              <TableHead className="text-center">%</TableHead>
              <TableHead className="text-center">{t.savingsStatus}</TableHead>
              <TableHead className="text-right">{t.savingsMonthlyNeeded}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {liveGoals.map(g => {
              const pct = Number(g.target_amount) > 0 ? Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100) : 0;
              const status = getStatus(g);
              const monthly = getMonthlyNeeded(g);
              const cfg = statusConfig[status];
              return (
                <TableRow key={g.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="text-xl text-center">{g.icon}</TableCell>
                  <TableCell className="font-medium">{g.name}</TableCell>
                  <TableCell>
                    <Progress value={Math.min(pct, 100)} className={`h-2.5 rounded-full ${status === 'completed' ? '[&>div]:bg-secondary' : status === 'late' ? '[&>div]:bg-destructive' : '[&>div]:bg-primary'}`} />
                  </TableCell>
                  <TableCell className="text-right text-sm whitespace-nowrap amount-display">
                    <span className="font-semibold">{fmt(Number(g.current_amount))}</span>
                    <span className="text-muted-foreground"> / {fmt(Number(g.target_amount))}</span>
                  </TableCell>
                  <TableCell className="text-center font-bold text-sm">{pct}%</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={cfg.variant} className={`text-[10px] ${cfg.className}`}>{cfg.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium amount-display">
                    {monthly !== null && monthly > 0 ? `${fmt(Math.round(monthly))}/${locale === 'fr' ? 'mois' : 'mo'}` : '—'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell></TableCell>
              <TableCell className="font-bold">{t.savingsTotal}</TableCell>
              <TableCell>
                <Progress value={Math.min(totalPct, 100)} className="h-2.5 rounded-full [&>div]:bg-primary" />
              </TableCell>
              <TableCell className="text-right text-sm whitespace-nowrap amount-display">
                <span className="font-bold">{fmt(totalCurrent)}</span>
                <span className="text-muted-foreground"> / {fmt(totalTarget)}</span>
              </TableCell>
              <TableCell className="text-center font-bold text-sm">{totalPct}%</TableCell>
              <TableCell></TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
};
