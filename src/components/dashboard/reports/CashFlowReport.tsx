import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const CashFlowReport = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const t = dashT[locale];
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<{ label: string; carry: number; income: number; expenses: number; net: number; endBalance: number }[]>([]);

  const fmt = (n: number) => fmtCurrency(n, locale);

  useEffect(() => {
    if (!user) return;
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    supabase.from('transactions').select('type, amount, date')
      .eq('user_id', user.id).gte('date', start).lte('date', end)
      .then(({ data: txs }) => {
        const months: typeof data = [];
        let carry = 0;
        for (let m = 0; m < 12; m++) {
          const monthTxs = (txs || []).filter(tx => {
            const d = new Date(tx.date);
            return d.getMonth() === m && d.getFullYear() === year;
          });
          const income = monthTxs.filter(tx => tx.type === 'income').reduce((s, tx) => s + Number(tx.amount), 0);
          const expenses = monthTxs.filter(tx => tx.type === 'expense').reduce((s, tx) => s + Number(tx.amount), 0);
          const net = income - expenses;
          const endBalance = carry + net;
          months.push({
            label: new Date(year, m).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { month: 'long' }),
            carry,
            income,
            expenses,
            net,
            endBalance,
          });
          carry = endBalance;
        }
        setData(months);
      });
  }, [user, year, locale]);

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const totalIncome = data.reduce((s, d) => s + d.income, 0);
  const totalExpenses = data.reduce((s, d) => s + d.expenses, 0);

  return (
    <Card className="border-none shadow-[var(--shadow-card)]">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base">{t.cashFlow}</CardTitle>
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
          <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{locale === 'fr' ? 'Mois' : 'Month'}</TableHead>
                <TableHead className="text-right">{t.startingBalance}</TableHead>
                <TableHead className="text-right">{t.income}</TableHead>
                <TableHead className="text-right">{t.expenses}</TableHead>
                <TableHead className="text-right">{t.netCashFlow}</TableHead>
                <TableHead className="text-right">{t.endingBalance}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium capitalize">{row.label}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">{fmt(row.carry)}</TableCell>
                  <TableCell className="text-right text-sm text-secondary font-medium">+{fmt(row.income)}</TableCell>
                  <TableCell className="text-right text-sm text-destructive font-medium">-{fmt(row.expenses)}</TableCell>
                  <TableCell className={`text-right text-sm font-bold ${row.net >= 0 ? 'text-secondary' : 'text-destructive'}`}>{fmt(row.net)}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">{fmt(row.endBalance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold">{(t as any).savingsTotal || 'Total'}</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right font-bold text-secondary">+{fmt(totalIncome)}</TableCell>
                <TableCell className="text-right font-bold text-destructive">-{fmt(totalExpenses)}</TableCell>
                <TableCell className={`text-right font-bold ${totalIncome - totalExpenses >= 0 ? 'text-secondary' : 'text-destructive'}`}>{fmt(totalIncome - totalExpenses)}</TableCell>
                <TableCell className="text-right font-bold">{data.length > 0 ? fmt(data[data.length - 1].endBalance) : '—'}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default CashFlowReport;
