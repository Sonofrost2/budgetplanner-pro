import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';

const BudgetVsActualReport = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const t = dashT[locale];
  const [rows, setRows] = useState<{ name: string; icon: string; color: string; budget: number; actual: number; variance: number; pct: number }[]>([]);

  const fmt = (n: number) => fmtCurrency(n, locale);

  useEffect(() => {
    if (!user) return;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    Promise.all([
      supabase.from('budgets').select('*, categories(name, icon, color)').eq('user_id', user.id),
      supabase.from('transactions').select('category_id, amount').eq('user_id', user.id).eq('type', 'expense')
        .gte('date', monthStart).lte('date', monthEnd),
    ]).then(([budRes, txRes]) => {
      const budgets = budRes.data || [];
      const txs = txRes.data || [];
      const result = budgets.map(b => {
        const spent = txs.filter(tx => tx.category_id === b.category_id).reduce((s, tx) => s + Number(tx.amount), 0);
        const amount = Number(b.amount);
        const variance = amount - spent;
        const pct = amount > 0 ? Math.round((spent / amount) * 100) : 0;
        return {
          name: b.name,
          icon: (b.categories as any)?.icon || '📁',
          color: (b.categories as any)?.color || '#6C63FF',
          budget: amount,
          actual: spent,
          variance,
          pct,
        };
      });
      setRows(result);
    });
  }, [user]);

  const totalBudget = rows.reduce((s, r) => s + r.budget, 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);
  const totalPct = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : 0;

  const getPctColor = (pct: number) => {
    if (pct > 100) return 'text-destructive';
    if (pct >= 80) return 'text-accent';
    return 'text-secondary';
  };

  const getBarClass = (pct: number) => {
    if (pct > 100) return '[&>div]:bg-destructive';
    if (pct >= 80) return '[&>div]:bg-accent';
    return '[&>div]:bg-secondary';
  };

  return (
    <Card className="border-none shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle className="text-base">{t.budgetVsActual}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">{t.noBudgets}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.category}</TableHead>
                  <TableHead className="text-right">{locale === 'fr' ? 'Budget' : 'Budget'}</TableHead>
                  <TableHead className="text-right">{locale === 'fr' ? 'Réel' : 'Actual'}</TableHead>
                  <TableHead className="text-right">{t.variance}</TableHead>
                  <TableHead className="min-w-[120px]">{t.consumptionPct}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">
                      <span className="mr-2">{r.icon}</span>{r.name}
                    </TableCell>
                    <TableCell className="text-right text-sm">{fmt(r.budget)}</TableCell>
                    <TableCell className="text-right text-sm font-semibold">{fmt(r.actual)}</TableCell>
                    <TableCell className={`text-right text-sm font-semibold ${r.variance >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                      {r.variance >= 0 ? '+' : ''}{fmt(r.variance)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={Math.min(r.pct, 100)} className={`h-2 flex-1 rounded-full ${getBarClass(r.pct)}`} />
                        <span className={`text-xs font-bold w-10 text-right ${getPctColor(r.pct)}`}>{r.pct}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-bold">{t.savingsTotal}</TableCell>
                  <TableCell className="text-right font-bold">{fmt(totalBudget)}</TableCell>
                  <TableCell className="text-right font-bold">{fmt(totalActual)}</TableCell>
                  <TableCell className={`text-right font-bold ${totalBudget - totalActual >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                    {totalBudget - totalActual >= 0 ? '+' : ''}{fmt(totalBudget - totalActual)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={Math.min(totalPct, 100)} className={`h-2 flex-1 rounded-full ${getBarClass(totalPct)}`} />
                      <span className={`text-xs font-bold w-10 text-right ${getPctColor(totalPct)}`}>{totalPct}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BudgetVsActualReport;
