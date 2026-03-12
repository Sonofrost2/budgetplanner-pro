import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
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
  const [transactions, setTransactions] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<{ name: string; income: number; expenses: number }[]>([]);
  const [categoryData, setCategoryData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [period, setPeriod] = useState<PeriodKey>('thisMonth');
  const [loading, setLoading] = useState(true);

  const fmt = (n: number) => fmtCurrency(n, locale);

  const fetchDashboard = useCallback(() => {
    if (!user) return;
    const { start, end } = getDateRange(period);

    Promise.all([
      supabase.from('transactions').select('*, categories(name, icon, color)')
        .eq('user_id', user.id).gte('date', start).lte('date', end)
        .order('date', { ascending: false }).limit(5000),
      supabase.from('transactions').select('amount, categories(name, color, icon)')
        .eq('user_id', user.id).eq('type', 'expense')
        .gte('date', start).lte('date', end),
      supabase.from('payment_accounts').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('savings_goals').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(5),
      supabase.from('budgets').select('*').eq('user_id', user.id)
        .order('created_at', { ascending: false }).limit(5),
    ]).then(([txRes, catRes, accRes, savRes, budRes]) => {
      if (txRes.error) console.error('Transactions fetch error:', txRes.error.message);
      if (accRes.error) console.error('Accounts fetch error:', accRes.error.message);
      if (savRes.error) console.error('Savings fetch error:', savRes.error.message);
      if (budRes.error) console.error('Budgets fetch error:', budRes.error.message);

      setTransactions(txRes.data || []);
      setAccounts(accRes.data || []);
      setSavingsGoals(savRes.data || []);

      // Category pie data
      const catMap: Record<string, { name: string; value: number; color: string }> = {};
      (catRes.data || []).forEach((tx: any) => {
        const name = tx.categories?.name || 'Autre';
        const color = tx.categories?.color || '#6C63FF';
        if (!catMap[name]) catMap[name] = { name, value: 0, color };
        catMap[name].value += Number(tx.amount);
      });
      setCategoryData(Object.values(catMap).sort((a, b) => b.value - a.value));

      // Budgets with spent calculation
      const budgetsData = budRes.data || [];
      const allTx = txRes.data || [];
      const budgetsWithSpent = budgetsData.map((b: any) => {
        const spent = allTx
          .filter((tx: any) => tx.type === 'expense' && tx.category_id === b.category_id)
          .reduce((s: number, tx: any) => s + Number(tx.amount), 0);
        return { ...b, spent };
      });
      setBudgets(budgetsWithSpent);
      setLoading(false);
    }).catch(err => {
      console.error('Dashboard fetch error:', err);
      setLoading(false);
    });

    // Chart: last 6 months
    const now = new Date();
    const months: { date: Date; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ date: d, label: d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' }) });
    }
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0];
    supabase.from('transactions').select('type, amount, date')
      .eq('user_id', user.id).gte('date', sixMonthsAgo)
      .then(({ data, error }) => {
        if (error) { console.error('Chart fetch error:', error.message); return; }
        const chartData = months.map(m => {
          const monthTxs = (data || []).filter((tx: any) => {
            const txDate = new Date(tx.date);
            return txDate.getMonth() === m.date.getMonth() && txDate.getFullYear() === m.date.getFullYear();
          });
          return {
            name: m.label,
            income: monthTxs.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + Number(t.amount), 0),
            expenses: monthTxs.filter((t: any) => t.type === 'expense').reduce((s: number, t: any) => s + Number(t.amount), 0),
          };
        });
        setMonthlyData(chartData);
      });
  }, [user, locale, period]);

  // Fetch on mount and period/user changes
  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  // Auto-refresh when window regains focus (after navigating to transactions/accounts pages)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchDashboard();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchDashboard]);

  // Global balance: sum of all account real_balances
  const totalBalance = accounts.reduce((s, a) => s + Number(a.real_balance), 0);
  // Period-filtered stats for display
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between"><Skeleton className="h-9 w-40" /><Skeleton className="h-9 w-40" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
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
      <StatsCards balance={totalBalance} totalIncome={totalIncome} totalExpenses={totalExpenses} fmt={fmt} t={t} />

      {/* Accounts + Budgets + Savings row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AccountsWidget accounts={accounts} fmt={fmt} t={t} />
        <BudgetsWidget budgets={budgets} fmt={fmt} t={t} />
        <SavingsWidget goals={savingsGoals} fmt={fmt} t={t} locale={locale} />
      </div>

      {/* Forecast widget */}
      <ForecastWidget monthlyData={monthlyData} fmt={fmt} t={t} />

      {/* Charts */}
      <ChartsSection monthlyData={monthlyData} categoryData={categoryData} fmt={fmt} t={t} />

      {/* Recent Transactions */}
      <RecentTransactions transactions={transactions} fmt={fmt} t={t} locale={locale} />
    </div>
  );
};

export default DashboardHome;
