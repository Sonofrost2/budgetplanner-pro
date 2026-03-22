import { useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, CalendarRange, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';
import { StatsCards } from '@/components/dashboard/home/StatsCards';
import { AccountsWidget } from '@/components/dashboard/home/AccountsWidget';
import { SavingsWidget } from '@/components/dashboard/home/SavingsWidget';
import { BudgetsWidget } from '@/components/dashboard/home/BudgetsWidget';
import { ForecastWidget } from '@/components/dashboard/home/ForecastWidget';
import { ChartsSection } from '@/components/dashboard/home/ChartsSection';
import { RecentTransactions } from '@/components/dashboard/home/RecentTransactions';
import { AccountsSummaryWidget } from '@/components/dashboard/home/AccountsSummaryWidget';
import { WeeklyPlannerWidget } from '@/components/dashboard/home/WeeklyPlannerWidget';
import { useAccounts, useTransactionsRange, useBudgets, useSavingsGoals, useChartData } from '@/hooks/useDashboardData';

type PeriodKey = 'today' | 'thisWeek' | 'thisMonth' | 'thisQuarter' | 'thisSemester' | 'thisYear' | 'custom';

const getDateRange = (period: PeriodKey) => {
  const now = new Date();
  let start: Date;
  switch (period) {
    case 'today':
      start = new Date(now);
      break;
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
    case 'thisSemester': {
      const s = now.getMonth() < 6 ? 0 : 6;
      start = new Date(now.getFullYear(), s, 1);
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

const getPreviousRange = (startStr: string, endStr: string) => {
  const s = new Date(startStr);
  const e = new Date(endStr);
  const durationMs = e.getTime() - s.getTime();
  const prevEnd = new Date(s.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - durationMs);
  return { start: prevStart.toISOString().split('T')[0], end: prevEnd.toISOString().split('T')[0] };
};

const buildDailyData = (
  transactions: { date: string; type: string; amount: number }[],
  startStr: string, endStr: string, filterType?: 'income' | 'expense',
): number[] => {
  const s = new Date(startStr);
  const e = new Date(endStr);
  const dayMap: Record<string, number> = {};
  transactions.forEach(tx => {
    if (filterType && tx.type !== filterType) return;
    const d = tx.date.split('T')[0];
    dayMap[d] = (dayMap[d] || 0) + Number(tx.amount);
  });
  const days: number[] = [];
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    days.push(dayMap[d.toISOString().split('T')[0]] || 0);
  }
  return days;
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' as const } },
};

const DashboardHome = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { profile, fmt: fmtCurrency } = useProfile();
  const t = dashT[locale];
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodKey>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [appliedCustom, setAppliedCustom] = useState<{ start: string; end: string } | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const fmt = (n: number) => fmtCurrency(n, locale);

  const { start, end } = useMemo(() => {
    if (period === 'custom' && appliedCustom) return appliedCustom;
    return getDateRange(period);
  }, [period, appliedCustom]);

  const { start: prevStart, end: prevEnd } = useMemo(() => getPreviousRange(start, end), [start, end]);

  const periodDays = useMemo(() => {
    const s = new Date(start);
    const e = new Date(end);
    return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
  }, [start, end]);

  const { data: accounts = [], isLoading: accLoading } = useAccounts();
  const { data: transactions = [], isLoading: txLoading } = useTransactionsRange(start, end);
  const { data: prevTransactions = [] } = useTransactionsRange(prevStart, prevEnd);
  const { data: budgetsRaw = [], isLoading: budLoading } = useBudgets();
  const { data: savingsGoals = [], isLoading: savLoading } = useSavingsGoals();
  const { data: monthlyData = [] } = useChartData(locale);

  const yearStartForPlanner = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-01-01`;
  }, []);
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const { data: plannerTransactions = [] } = useTransactionsRange(yearStartForPlanner, todayStr);

  const loading = accLoading || txLoading || budLoading || savLoading;

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

  const budgets = useMemo(() => {
    return budgetsRaw.map(b => {
      const spent = transactions
        .filter(tx => tx.type === 'expense' && tx.category_id === b.category_id)
        .reduce((s, tx) => s + Number(tx.amount), 0);
      return { ...b, spent };
    }).slice(0, 5);
  }, [budgetsRaw, transactions]);

  const totalBalance = accounts.reduce((s, a) => s + Number(a.real_balance), 0);
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const transactionCount = transactions.length;
  const dailyAvgExpense = totalExpenses / periodDays;

  const prevIncome = prevTransactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const prevExpenses = prevTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const prevPeriodDays = Math.max(1, Math.round((new Date(prevEnd).getTime() - new Date(prevStart).getTime()) / 86400000) + 1);
  const prevDailyAvg = prevExpenses / prevPeriodDays;
  const prevSavingsRate = prevIncome > 0 ? ((prevIncome - prevExpenses) / prevIncome) * 100 : 0;

  const topExpense = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense');
    if (expenses.length === 0) return undefined;
    const top = expenses.reduce((max, tx) => Number(tx.amount) > Number(max.amount) ? tx : max, expenses[0]);
    return { description: top.description, amount: Number(top.amount) };
  }, [transactions]);

  const topIncome = useMemo(() => {
    const incomes = transactions.filter(t => t.type === 'income');
    if (incomes.length === 0) return undefined;
    const top = incomes.reduce((max, tx) => Number(tx.amount) > Number(max.amount) ? tx : max, incomes[0]);
    return { description: top.description, amount: Number(top.amount) };
  }, [transactions]);

  const dailyIncomeData = useMemo(() => buildDailyData(transactions, start, end, 'income'), [transactions, start, end]);
  const dailyExpenseData = useMemo(() => buildDailyData(transactions, start, end, 'expense'), [transactions, start, end]);
  const dailyBalanceData = useMemo(() => {
    const inc = buildDailyData(transactions, start, end, 'income');
    const exp = buildDailyData(transactions, start, end, 'expense');
    let running = 0;
    return inc.map((v, i) => { running += v - exp[i]; return running; });
  }, [transactions, start, end]);

  const handlePeriodChange = (v: string) => {
    if (v === 'custom') { setPeriod('custom'); setCustomOpen(true); }
    else { setPeriod(v as PeriodKey); setAppliedCustom(null); }
  };

  const applyCustom = () => {
    if (customStart && customEnd) { setAppliedCustom({ start: customStart, end: customEnd }); setCustomOpen(false); }
  };

  const periodLabel = useMemo(() => {
    if (period === 'custom' && appliedCustom) {
      const fmtDate = (d: string) => new Date(d).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' });
      return `${fmtDate(appliedCustom.start)} → ${fmtDate(appliedCustom.end)}`;
    }
    return undefined;
  }, [period, appliedCustom, locale]);

  // Greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const name = profile?.display_name?.split(' ')[0] || '';
    const isFr = locale === 'fr';
    let greet = '';
    if (hour < 12) greet = isFr ? 'Bonjour' : 'Good morning';
    else if (hour < 18) greet = isFr ? 'Bon après-midi' : 'Good afternoon';
    else greet = isFr ? 'Bonsoir' : 'Good evening';
    return name ? `${greet}, ${name}` : `${greet}`;
  }, [locale, profile]);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48 rounded-xl" />
          <Skeleton className="h-9 w-36 rounded-xl" />
        </div>
        <Skeleton className="h-36 rounded-3xl" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <Skeleton className="h-80 rounded-2xl lg:col-span-3" />
          <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
      {/* ── Header: Greeting + Period + Add ── */}
      <motion.div variants={fadeUp} className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            {greeting}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-40 h-9 glass border-glass-border rounded-xl text-xs font-medium"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">{t.today}</SelectItem>
              <SelectItem value="thisWeek">{t.thisWeek}</SelectItem>
              <SelectItem value="thisMonth">{t.thisMonth}</SelectItem>
              <SelectItem value="thisQuarter">{t.thisQuarter}</SelectItem>
              <SelectItem value="thisSemester">{t.thisSemester}</SelectItem>
              <SelectItem value="thisYear">{t.thisYear}</SelectItem>
              <SelectItem value="custom">
                <span className="flex items-center gap-1.5"><CalendarRange className="w-3.5 h-3.5" />{t.customPeriod}</span>
              </SelectItem>
            </SelectContent>
          </Select>
          {periodLabel && (
            <span className="text-[10px] text-muted-foreground bg-muted/50 rounded-lg px-2 py-1 hidden sm:inline">{periodLabel}</span>
          )}
          <Popover open={customOpen} onOpenChange={setCustomOpen}>
            <PopoverTrigger asChild><span /></PopoverTrigger>
            <PopoverContent className="w-72 p-4 space-y-3" align="start">
              <div className="space-y-2">
                <Label className="text-xs">{t.from}</Label>
                <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{t.to}</Label>
                <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-8 text-xs" />
              </div>
              <Button size="sm" className="w-full" onClick={applyCustom} disabled={!customStart || !customEnd}>{t.apply}</Button>
            </PopoverContent>
          </Popover>
          <Button
            size="sm"
            className="text-primary-foreground rounded-xl btn-glow-primary h-9 px-4"
            style={{ background: 'var(--gradient-primary)' }}
            onClick={() => navigate('/dashboard/transactions')}
          >
            <Plus className="w-4 h-4 mr-1" />{t.addTransaction}
          </Button>
        </div>
      </motion.div>

      {/* ── Hero Stats ── */}
      <motion.div variants={fadeUp}>
        <StatsCards
          balance={totalBalance} totalIncome={totalIncome} totalExpenses={totalExpenses} fmt={fmt} t={t}
          onIncomeClick={() => navigate('/dashboard/transactions?type=income')}
          onExpenseClick={() => navigate('/dashboard/transactions?type=expense')}
          onBalanceClick={() => navigate('/dashboard/accounts')}
          savingsRate={totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0}
          netCashFlow={totalIncome - totalExpenses}
          transactionCount={transactionCount}
          dailyAverage={dailyAvgExpense}
          topExpense={topExpense}
          topIncome={topIncome}
          prevIncome={prevIncome}
          prevExpenses={prevExpenses}
          prevNetCashFlow={prevIncome - prevExpenses}
          prevTransactionCount={prevTransactions.length}
          prevDailyAverage={prevDailyAvg}
          prevSavingsRate={prevSavingsRate}
          dailyIncomeData={dailyIncomeData}
          dailyExpenseData={dailyExpenseData}
          dailyBalanceData={dailyBalanceData}
        />
      </motion.div>

      {/* ── Bento Grid: Main content ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left column — 3/5: Weekly Planner + Charts */}
        <motion.div variants={fadeUp} className="lg:col-span-3 space-y-4">
          {/* Weekly Planner — prominent */}
          <WeeklyPlannerWidget budgets={budgetsRaw} transactions={plannerTransactions} fmt={fmt} t={t} />

          {/* Charts */}
          <ChartsSection monthlyData={monthlyData} categoryData={categoryData} fmt={fmt} t={t} locale={locale} />
        </motion.div>

        {/* Right column — 2/5: Accounts + Budgets + Savings */}
        <motion.div variants={fadeUp} className="lg:col-span-2 space-y-4">
          <AccountsSummaryWidget accounts={accounts} fmt={fmt} t={t} locale={locale} />
          <BudgetsWidget budgets={budgets} fmt={fmt} t={t} />
          <SavingsWidget goals={savingsGoals.slice(0, 5)} fmt={fmt} t={t} locale={locale} />
        </motion.div>
      </div>

      {/* ── Forecast + Recent Transactions — full width ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={fadeUp}>
          <ForecastWidget monthlyData={monthlyData} fmt={fmt} t={t} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <RecentTransactions transactions={transactions.slice(0, 10)} fmt={fmt} t={t} locale={locale} />
        </motion.div>
      </div>
    </motion.div>
  );
};

export default DashboardHome;
