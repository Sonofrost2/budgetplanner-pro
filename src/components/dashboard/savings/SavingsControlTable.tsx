import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import type { DashTranslations } from '@/i18n/dashTranslations';

import type { SavingsGoal } from '@/hooks/useDashboardData';

interface SavingsContribution {
  id: string;
  amount: number;
  date: string;
  type: string;
}

interface SavingsControlTableProps {
  goals: SavingsGoal[];
  contributions: Record<string, SavingsContribution[]>;
  fmt: (n: number) => string;
  t: DashTranslations;
  locale: string;
}

export const SavingsControlTable = ({ goals, contributions, fmt, t, locale }: SavingsControlTableProps) => {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const rows = goals
    .filter(g => Number(g.current_amount) < Number(g.target_amount) && (g.monthly_contribution > 0 || g.deadline))
    .map(g => {
      // Use explicit monthly_contribution if set, otherwise calculate from deadline
      let plannedMonthly = Number(g.monthly_contribution) || 0;
      if (plannedMonthly <= 0 && g.deadline) {
        const start = g.start_date ? new Date(g.start_date) : new Date(g.created_at);
        const deadline = new Date(g.deadline);
        const totalMonths = Math.max(1, (deadline.getFullYear() - start.getFullYear()) * 12 + deadline.getMonth() - start.getMonth());
        plannedMonthly = Number(g.target_amount) / totalMonths;
      }

      const goalContribs = contributions[g.id] || [];
      const thisMonthContribs = goalContribs.filter(c => c.type === 'deposit' && c.date?.startsWith(currentMonth));
      const thisMonthAmount = thisMonthContribs.reduce((s: number, c: any) => s + Number(c.amount), 0);
      const totalContributed = goalContribs.filter(c => c.type === 'deposit').reduce((s: number, c: any) => s + Number(c.amount), 0);
      const variance = thisMonthAmount - plannedMonthly;

      return {
        icon: g.icon,
        name: g.name,
        plannedMonthly,
        thisMonthAmount,
        totalContributed,
        variance,
      };
    });

  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border/50 shadow-[var(--shadow-card)] bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border/50">
        <h3 className="text-base font-bold">{locale === 'fr' ? 'Contrôle des cotisations' : 'Contribution Control'}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{locale === 'fr' ? 'Cotisation prévue vs réelle ce mois' : 'Planned vs actual this month'}</p>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>{locale === 'fr' ? 'Objectif' : 'Goal'}</TableHead>
              <TableHead className="text-right">{locale === 'fr' ? 'Prévu/mois' : 'Planned/mo'}</TableHead>
              <TableHead className="text-right">{locale === 'fr' ? 'Versé ce mois' : 'This month'}</TableHead>
              <TableHead className="text-right">{locale === 'fr' ? 'Cumul' : 'Total'}</TableHead>
              <TableHead className="text-right">{(t as any).variance || 'Écart'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="text-xl text-center">{r.icon}</TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-right text-sm">{fmt(Math.round(r.plannedMonthly))}</TableCell>
                <TableCell className="text-right text-sm font-semibold">{fmt(r.thisMonthAmount)}</TableCell>
                <TableCell className="text-right text-sm">{fmt(r.totalContributed)}</TableCell>
                <TableCell className={`text-right text-sm font-bold ${r.variance >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                  {r.variance >= 0 ? '+' : ''}{fmt(Math.round(r.variance))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
