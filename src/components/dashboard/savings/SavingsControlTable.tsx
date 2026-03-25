import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
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
  const isFr = locale === 'fr';

  const rows = goals
    .filter(g => Number(g.current_amount) < Number(g.target_amount) && (g.monthly_contribution > 0 || g.deadline))
    .map(g => {
      let plannedMonthly = Number(g.monthly_contribution) || 0;
      if (plannedMonthly <= 0 && g.deadline) {
        const start = g.start_date ? new Date(g.start_date) : new Date(g.created_at);
        const deadline = new Date(g.deadline);
        const totalMonths = Math.max(1, (deadline.getFullYear() - start.getFullYear()) * 12 + deadline.getMonth() - start.getMonth());
        plannedMonthly = Number(g.target_amount) / totalMonths;
      }

      const goalContribs = contributions[g.id] || [];
      const thisMonthContribs = goalContribs.filter(c => c.type === 'deposit' && c.date?.startsWith(currentMonth));
      const thisMonthAmount = thisMonthContribs.reduce((s, c) => s + Number(c.amount), 0);
      
      const totalDeposits = goalContribs.filter(c => c.type === 'deposit').reduce((s, c) => s + Number(c.amount), 0);
      const totalWithdrawals = goalContribs.filter(c => c.type === 'withdrawal').reduce((s, c) => s + Number(c.amount), 0);
      const netContributed = totalDeposits - totalWithdrawals;
      
      // Include the linked account's opening_balance to avoid false discrepancies
      const openingBalance = Number((g.payment_accounts as any)?.opening_balance) || 0;
      
      const currentAmount = Number(g.current_amount);
      const discrepancy = currentAmount - (openingBalance + netContributed);
      const variance = thisMonthAmount - plannedMonthly;

      return {
        icon: g.icon,
        name: g.name,
        plannedMonthly,
        thisMonthAmount,
        totalDeposits,
        totalWithdrawals,
        netContributed,
        openingBalance,
        currentAmount,
        discrepancy,
        variance,
      };
    });

  if (rows.length === 0) return null;

  const totalDiscrepancy = rows.reduce((s, r) => s + r.discrepancy, 0);

  return (
    <div className="rounded-2xl border border-border/50 shadow-[var(--shadow-card)] bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold">{isFr ? 'Contrôle des cotisations' : 'Contribution Control'}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{isFr ? 'Cotisation prévue vs réelle + écarts cumulés' : 'Planned vs actual + cumulative discrepancies'}</p>
          </div>
          {totalDiscrepancy !== 0 && (
            <Badge variant={Math.abs(totalDiscrepancy) > 100 ? 'destructive' : 'secondary'} className="text-xs">
              {totalDiscrepancy > 0 ? (
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {isFr ? 'Écart total' : 'Total gap'}: {totalDiscrepancy > 0 ? '+' : ''}{fmt(Math.round(totalDiscrepancy))}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {isFr ? 'Écart total' : 'Total gap'}: {fmt(Math.round(totalDiscrepancy))}
                </span>
              )}
            </Badge>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
         <TableHeader>
            <TableRow>
              <TableHead></TableHead>
              <TableHead>{isFr ? 'Objectif' : 'Goal'}</TableHead>
              <TableHead className="text-right">{isFr ? 'Prévu/mois' : 'Planned/mo'}</TableHead>
              <TableHead className="text-right">{isFr ? 'Versé ce mois' : 'This month'}</TableHead>
              <TableHead className="text-right">{t.variance}</TableHead>
              <TableHead className="text-right">{isFr ? 'Solde initial' : 'Opening'}</TableHead>
              <TableHead className="text-right">{isFr ? 'Cumul versé' : 'Total paid'}</TableHead>
              <TableHead className="text-right">{isFr ? 'Solde affiché' : 'Shown balance'}</TableHead>
              <TableHead className="text-right">{isFr ? 'Écart' : 'Gap'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => {
              const hasDiscrepancy = Math.abs(r.discrepancy) > 1;
              return (
                <TableRow key={i} className={hasDiscrepancy ? 'bg-amber-500/5' : ''}>
                  <TableCell className="text-xl text-center">{r.icon}</TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right text-sm">{fmt(Math.round(r.plannedMonthly))}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">{fmt(r.thisMonthAmount)}</TableCell>
                  <TableCell className={`text-right text-sm font-bold ${r.variance >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                    {r.variance >= 0 ? '+' : ''}{fmt(Math.round(r.variance))}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">{fmt(r.openingBalance)}</TableCell>
                  <TableCell className="text-right text-sm">
                    <div>{fmt(r.netContributed)}</div>
                    {r.totalWithdrawals > 0 && (
                      <div className="text-[10px] text-muted-foreground">
                        ↑{fmt(r.totalDeposits)} ↓{fmt(r.totalWithdrawals)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold">{fmt(r.currentAmount)}</TableCell>
                  <TableCell className="text-right text-sm">
                    {hasDiscrepancy ? (
                      <span className={`inline-flex items-center gap-1 font-bold ${Math.abs(r.discrepancy) > 100 ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}`}>
                        <AlertTriangle className="w-3 h-3" />
                        {r.discrepancy > 0 ? '+' : ''}{fmt(Math.round(r.discrepancy))}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-secondary">
                        <CheckCircle2 className="w-3 h-3" />
                        OK
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      {/* Legend */}
      <div className="px-5 py-3 border-t border-border/30 bg-muted/20">
        <p className="text-[11px] text-muted-foreground">
          {isFr
            ? '💡 Écart = Solde affiché − (Solde initial + Cumul net). Un écart positif peut indiquer des intérêts capitalisés ou ajustements manuels. Un écart négatif peut indiquer des versements non comptabilisés.'
            : '💡 Gap = Shown balance − (Opening + Net deposits). Positive gap may indicate capitalized interest or manual adjustments. Negative gap may indicate untracked deposits.'}
        </p>
      </div>
    </div>
  );
};
