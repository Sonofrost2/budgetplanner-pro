import { useMemo } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { useAllTransactions, useCategories } from '@/hooks/useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart as PieChartIcon, TrendingUp, TrendingDown, Inbox } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { abbreviateNumber, groupTopN } from '@/lib/utils';

const COLORS = ['#6C63FF', '#22C55E', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#06B6D4'];

const TOOLTIP_STYLE = {
  borderRadius: '12px',
  border: 'none',
  background: 'hsl(var(--card))',
  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
  fontSize: '12px',
  padding: '8px 12px',
};

const TransactionsStatsTab = () => {
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const t = dashT[locale];
  const { data: transactions = [] } = useAllTransactions();
  const { data: categories = [] } = useCategories();
  const fmt = (n: number) => fmtCurrency(n, locale);

  const totalIncome = transactions.filter(tx => tx.type === 'income').reduce((s, tx) => s + Number(tx.amount), 0);
  const totalExpense = transactions.filter(tx => tx.type === 'expense').reduce((s, tx) => s + Number(tx.amount), 0);

  const categoryData = useMemo(() => {
    const map: Record<string, { name: string; value: number; color: string }> = {};
    transactions.filter(tx => tx.type === 'expense').forEach(tx => {
      const cat = categories.find(c => c.id === tx.category_id);
      const name = cat ? `${cat.icon} ${cat.name}` : (locale === 'fr' ? 'Sans catégorie' : 'Uncategorized');
      const color = cat?.color || '#94A3B8';
      if (!map[name]) map[name] = { name, value: 0, color };
      map[name].value += Number(tx.amount);
    });
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [transactions, categories, locale]);

  const groupedCategoryData = useMemo(() => groupTopN(categoryData, 5, locale), [categoryData, locale]);
  const totalCat = groupedCategoryData.reduce((s, d) => s + d.value, 0);

  const monthlyData = useMemo(() => {
    const now = new Date();
    const months: { month: string; income: number; expense: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const label = d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' });
      let income = 0, expense = 0;
      transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (txDate >= d && txDate <= end) {
          if (tx.type === 'income') income += Number(tx.amount);
          else expense += Number(tx.amount);
        }
      });
      months.push({ month: label, income, expense });
    }
    return months;
  }, [transactions, locale]);

  if (transactions.length === 0) {
    return (
      <Card className="border border-border/50 rounded-2xl">
        <CardContent className="py-12 text-center">
          <Inbox className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">{t.noDataYet}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-border/50 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.income}</p>
            <p className="text-xl font-bold text-secondary flex items-center gap-1"><TrendingUp className="w-4 h-4" />{fmt(totalIncome)}</p>
          </CardContent>
        </Card>
        <Card className="border border-border/50 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.expenses}</p>
            <p className="text-xl font-bold text-destructive flex items-center gap-1"><TrendingDown className="w-4 h-4" />{fmt(totalExpense)}</p>
          </CardContent>
        </Card>
        <Card className="border border-border/50 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{locale === 'fr' ? 'Solde net' : 'Net'}</p>
            <p className={`text-xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-secondary' : 'text-destructive'}`}>{fmt(totalIncome - totalExpense)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie chart with external legend */}
        <Card className="border border-border/50 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-primary" />
              {t.expenseByCategory}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={groupedCategoryData}
                    cx="50%" cy="50%"
                    outerRadius={75} innerRadius={42}
                    dataKey="value"
                    stroke="hsl(var(--card))" strokeWidth={2}
                    animationDuration={1000}
                  >
                    {groupedCategoryData.map((d, i) => <Cell key={i} fill={d.color || COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
              {groupedCategoryData.map((d, i) => {
                const pct = totalCat > 0 ? ((d.value / totalCat) * 100).toFixed(1) : '0';
                return (
                  <div key={i} className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color || COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-muted-foreground truncate">{d.name}</span>
                    <span className="text-xs font-semibold ml-auto shrink-0">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Monthly bar chart */}
        <Card className="border border-border/50 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">{t.incomeVsExpenses}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => abbreviateNumber(v, locale)} />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="income" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} name={t.income} />
                  <Bar dataKey="expense" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name={t.expenses} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-3 h-1 rounded-full bg-secondary" />
                {t.income}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-3 h-1 rounded-full bg-destructive" />
                {t.expenses}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TransactionsStatsTab;
