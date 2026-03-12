import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { StatsCards } from '@/components/dashboard/home/StatsCards';
import { AccountsWidget } from '@/components/dashboard/home/AccountsWidget';
import { SavingsWidget } from '@/components/dashboard/home/SavingsWidget';
import { BudgetsWidget } from '@/components/dashboard/home/BudgetsWidget';
import { ForecastWidget } from '@/components/dashboard/home/ForecastWidget';
import { ChartsSection } from '@/components/dashboard/home/ChartsSection';
import { RecentTransactions } from '@/components/dashboard/home/RecentTransactions';
import { AccountsSummaryWidget } from '@/components/dashboard/home/AccountsSummaryWidget';
import { useAccounts, useTransactionsRange, useBudgets, useSavingsGoals, useChartData } from '@/hooks/useDashboardData';

type PeriodKey = 'thisWeek' | 'thisMonth' | 'thisQuarter' | 'thisYear';

const getDateRange = (period: PeriodKey) => {
  const now = new Date();
  let start: Date;
  switch (period) {
    case 'thisWeek': {
      const day = now.getDay();
      start = new Date(now);
      start.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      break;
    }
    case 'thisQuarter': {
      const q = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), q * 3, 1);
      break;
    }
    case 'thisYear':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  start.setHours(0, 0, 0, 0);
  return { start: start.toISOString().split('T')[0], end: now.toISOString().split('T')[0] };
};

const DashboardHome = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const t = dashT[locale];
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodKey>('thisMonth');
  const fmt = (n: number) => fmtCurrency(n, locale);

  const { start, end } = useMemo(() => getDateRange(period), [period]);

  // React-query hooks
  const { data: accounts = [], isLoading: accLoading } = useAccounts();
  const { data: transactions = [], isLoading: txLoading } = useTransactionsRange(start, end);
  const { data: budgetsRaw = [], isLoading: budLoading } = useBudgets();
  const { data: savingsGoals = [], isLoading: savLoading } = useSavingsGoals();
  const { data: monthlyData = [], isLoading: chartLoading } = useChartData(locale);

  const loading = accLoading || txLoading || budLoading || savLoading;

  // Category pie data
  const categoryData = useMemo(() => {
    const catMap: Record<string, { name: string; value: number; color: string }> = {};
    transactions.filter(tx => tx.type === 'expense').forEach(tx => {
      const name = tx.categories?.name || 'Autre';
      const color = tx.categories?.color || '#6C63FF';
      if (!catMap[name]) catMap[name] = { name, value: 0, color };
      catMap[name].value += Number(tx.amount);
    });
    return Object.values(catMap).sort((a, b) => b.value - a.value);
  }, [transactions]);

  // Budgets with spent calculation
  const budgets = useMemo(() => {
    return budgetsRaw.map(b => {
      const spent = transactions
        .filter(tx => tx.type === 'expense' && tx.category_id === b.category_id)
        .reduce((s, tx) => s + Number(tx.amount), 0);
      return { ...b, spent };
    }).slice(0, 5);
  }, [budgetsRaw, transactions]);

  // Stats
  const totalBalance = accounts.reduce((s, a) => s + Number(a.real_balance), 0);
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between"><Skeleton className="h-9 w-40" /><Skeleton className="h-9 w-40" /></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period selector + Add */}
      <div className="flex items-center justify-between gap-3">
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="thisWeek">{t.thisWeek}</SelectItem>
            <SelectItem value="thisMonth">{t.thisMonth}</SelectItem>
            <SelectItem value="thisQuarter">{t.thisQuarter}</SelectItem>
            <SelectItem value="thisYear">{t.thisYear}</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }} onClick={() => navigate('/dashboard/transactions')}>
          <Plus className="w-4 h-4 mr-1" />{t.addTransaction}
        </Button>
      </div>

      {/* Stats */}
      <StatsCards
        balance={totalBalance} totalIncome={totalIncome} totalExpenses={totalExpenses} fmt={fmt} t={t}
        savingsRate={totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0}
        netCashFlow={totalIncome - totalExpenses}
      />

      {/* Accounts Summary */}
      <AccountsSummaryWidget accounts={accounts} fmt={fmt} t={t} locale={locale} />

      {/* Accounts + Budgets + Savings row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AccountsWidget accounts={accounts} fmt={fmt} t={t} />
        <BudgetsWidget budgets={budgets} fmt={fmt} t={t} />
        <SavingsWidget goals={savingsGoals.slice(0, 5)} fmt={fmt} t={t} locale={locale} />
      </div>

      {/* Forecast widget */}
      <ForecastWidget monthlyData={monthlyData} fmt={fmt} t={t} />

      {/* Charts */}
      <ChartsSection monthlyData={monthlyData} categoryData={categoryData} fmt={fmt} t={t} />

      {/* Recent Transactions */}
      <RecentTransactions transactions={transactions.slice(0, 10)} fmt={fmt} t={t} locale={locale} />
    </div>
  );
};

export default DashboardHome;
