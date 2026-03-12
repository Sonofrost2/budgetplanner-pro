import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const DailyJournalReport = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const t = dashT[locale];
  const [data, setData] = useState<{ date: string; income: number; expenses: number; net: number; cumIncome: number; cumExpenses: number; balance: number }[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const fmt = (n: number) => fmtCurrency(n, locale);

  useEffect(() => {
    if (!user || !startDate || !endDate) return;
    supabase.from('transactions').select('type, amount, date')
      .eq('user_id', user.id).gte('date', startDate).lte('date', endDate)
      .order('date', { ascending: true })
      .then(({ data: txs }) => {
        const dayMap: Record<string, { income: number; expenses: number }> = {};
        (txs || []).forEach(tx => {
          if (!dayMap[tx.date]) dayMap[tx.date] = { income: 0, expenses: 0 };
          if (tx.type === 'income') dayMap[tx.date].income += Number(tx.amount);
          else dayMap[tx.date].expenses += Number(tx.amount);
        });

        const sorted = Object.keys(dayMap).sort();
        let cumIncome = 0, cumExpenses = 0;
        const rows = sorted.map(date => {
          const d = dayMap[date];
          cumIncome += d.income;
          cumExpenses += d.expenses;
          return {
            date,
            income: d.income,
            expenses: d.expenses,
            net: d.income - d.expenses,
            cumIncome,
            cumExpenses,
            balance: cumIncome - cumExpenses,
          };
        });
        setData(rows);
      });
  }, [user, startDate, endDate]);

  const totalIncome = data.reduce((s, d) => s + d.income, 0);
  const totalExpenses = data.reduce((s, d) => s + d.expenses, 0);

  return (
    <Card className="border-none shadow-[var(--shadow-card)]">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-4 flex-wrap gap-3">
        <CardTitle className="text-base">{t.dailyJournal}</CardTitle>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground">{t.startDate}</Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-8 w-36 text-xs rounded-lg" />
          </div>
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground">{t.endDate}</Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-8 w-36 text-xs rounded-lg" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">{t.noTransactions}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.date}</TableHead>
                  <TableHead className="text-right">{t.income}</TableHead>
                  <TableHead className="text-right">{t.expenses}</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead className="text-right">{locale === 'fr' ? 'Cumul Rev.' : 'Cum. Inc.'}</TableHead>
                  <TableHead className="text-right">{locale === 'fr' ? 'Cumul Dép.' : 'Cum. Exp.'}</TableHead>
                  <TableHead className="text-right">{locale === 'fr' ? 'Solde' : 'Balance'}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm font-medium">{new Date(row.date).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}</TableCell>
                    <TableCell className="text-right text-sm text-secondary">{row.income > 0 ? `+${fmt(row.income)}` : '—'}</TableCell>
                    <TableCell className="text-right text-sm text-destructive">{row.expenses > 0 ? `-${fmt(row.expenses)}` : '—'}</TableCell>
                    <TableCell className={`text-right text-sm font-semibold ${row.net >= 0 ? 'text-secondary' : 'text-destructive'}`}>{fmt(row.net)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{fmt(row.cumIncome)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{fmt(row.cumExpenses)}</TableCell>
                    <TableCell className={`text-right text-sm font-bold ${row.balance >= 0 ? 'text-secondary' : 'text-destructive'}`}>{fmt(row.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-bold">{(t as any).savingsTotal || 'Total'}</TableCell>
                  <TableCell className="text-right font-bold text-secondary">+{fmt(totalIncome)}</TableCell>
                  <TableCell className="text-right font-bold text-destructive">-{fmt(totalExpenses)}</TableCell>
                  <TableCell className={`text-right font-bold ${totalIncome - totalExpenses >= 0 ? 'text-secondary' : 'text-destructive'}`}>{fmt(totalIncome - totalExpenses)}</TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DailyJournalReport;
