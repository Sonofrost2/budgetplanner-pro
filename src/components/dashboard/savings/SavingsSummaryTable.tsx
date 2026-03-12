import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import type { DashTranslations } from '@/i18n/dashTranslations';

import type { SavingsGoal } from '@/hooks/useDashboardData';

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

const getMonthlyNeeded = (goal: any): number | null => {
  // Use explicit monthly_contribution if set
  if (Number(goal.monthly_contribution) > 0) return Number(goal.monthly_contribution);
  if (!goal.deadline) return null;
  const remaining = Number(goal.target_amount) - Number(goal.current_amount);
  if (remaining <= 0) return 0;
  const start = goal.start_date ? new Date(goal.start_date) : new Date();
  const dl = new Date(goal.deadline);
  const monthsLeft = Math.max(1, (dl.getFullYear() - start.getFullYear()) * 12 + dl.getMonth() - start.getMonth());
  return remaining / monthsLeft;
};

export const SavingsSummaryTable = ({ goals, contributions, fmt, t, locale }: SavingsSummaryTableProps) => {
  if (goals.length === 0) return null;

  const totalCurrent = goals.reduce((s, g) => s + Number(g.current_amount), 0);
  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0);
  const totalPct = totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0;

  const statusConfig = {
    completed: { label: (t as any).savingsCompleted || 'Atteint', variant: 'default' as const, className: 'bg-secondary text-secondary-foreground' },
    late: { label: (t as any).savingsLate || 'En retard', variant: 'destructive' as const, className: '' },
    inProgress: { label: (t as any).savingsInProgress || 'En cours', variant: 'default' as const, className: 'bg-primary/15 text-primary border-primary/20' },
  };

  return (
    <div className="rounded-2xl border border-border/50 shadow-[var(--shadow-card)] bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border/50">
        <h3 className="text-base font-bold">{(t as any).savingsSummary || 'Récapitulatif'}</h3>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>{locale === 'fr' ? 'Objectif' : 'Goal'}</TableHead>
              <TableHead className="min-w-[140px]">{t.progress}</TableHead>
              <TableHead className="text-right">{t.amount}</TableHead>
              <TableHead className="text-center">%</TableHead>
              <TableHead className="text-center">{(t as any).savingsStatus || 'Statut'}</TableHead>
              <TableHead className="text-right">{(t as any).savingsMonthlyNeeded || 'Mensualité'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {goals.map(g => {
              const pct = Number(g.target_amount) > 0 ? Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100) : 0;
              const status = getStatus(g);
              const monthly = getMonthlyNeeded(g);
              const cfg = statusConfig[status];
              return (
                <TableRow key={g.id}>
                  <TableCell className="text-xl text-center">{g.icon}</TableCell>
                  <TableCell className="font-medium">{g.name}</TableCell>
                  <TableCell>
                    <Progress value={Math.min(pct, 100)} className={`h-2.5 rounded-full ${status === 'completed' ? '[&>div]:bg-secondary' : status === 'late' ? '[&>div]:bg-destructive' : '[&>div]:bg-primary'}`} />
                  </TableCell>
                  <TableCell className="text-right text-sm whitespace-nowrap">
                    <span className="font-semibold">{fmt(Number(g.current_amount))}</span>
                    <span className="text-muted-foreground"> / {fmt(Number(g.target_amount))}</span>
                  </TableCell>
                  <TableCell className="text-center font-bold text-sm">{pct}%</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={cfg.variant} className={`text-[10px] ${cfg.className}`}>{cfg.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {monthly !== null && monthly > 0 ? `${fmt(Math.round(monthly))}/${locale === 'fr' ? 'mois' : 'mo'}` : '—'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell></TableCell>
              <TableCell className="font-bold">{(t as any).savingsTotal || 'Total'}</TableCell>
              <TableCell>
                <Progress value={Math.min(totalPct, 100)} className="h-2.5 rounded-full [&>div]:bg-primary" />
              </TableCell>
              <TableCell className="text-right text-sm whitespace-nowrap">
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
