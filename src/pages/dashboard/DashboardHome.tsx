import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, TrendingUp, TrendingDown, Inbox } from 'lucide-react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

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
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [period, setPeriod] = useState<PeriodKey>('thisMonth');
  const [loading, setLoading] = useState(true);

  const fmt = (n: number) => fmtCurrency(n, locale);

  useEffect(() => {
    if (!user) return;
    const { start, end } = getDateRange(period);

    supabase.from('transactions').select('*, categories(name, icon, color)')
      .eq('user_id', user.id)
      .gte('date', start).lte('date', end)
      .order('date', { ascending: false })
      .then(({ data }) => {
        setTransactions(data || []);
        setLoading(false);
      });

    // Chart: last 6 months
    const now = new Date();
    const months: any[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ date: d, label: d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' }) });
    }
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0];
    supabase.from('transactions').select('type, amount, date')
      .eq('user_id', user.id).gte('date', sixMonthsAgo)
      .then(({ data }) => {
        const chartData = months.map(m => {
          const monthTxs = (data || []).filter(tx => {
            const txDate = new Date(tx.date);
            return txDate.getMonth() === m.date.getMonth() && txDate.getFullYear() === m.date.getFullYear();
          });
          return {
            name: m.label,
            income: monthTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
            expenses: monthTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
          };
        });
        setMonthlyData(chartData);
      });
  }, [user, locale, period]);

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const balance = totalIncome - totalExpenses;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between"><Skeleton className="h-9 w-40" /><Skeleton className="h-9 w-40" /></div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: t.totalBalance, value: fmt(balance), color: '', icon: null, delay: 0 },
          { label: t.income, value: `+${fmt(totalIncome)}`, color: 'text-secondary', icon: TrendingUp, delay: 0.1 },
          { label: t.expenses, value: `-${fmt(totalExpenses)}`, color: 'text-destructive', icon: TrendingDown, delay: 0.2 },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: s.delay }}>
            <Card className="border-none shadow-[var(--shadow-card)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  {s.icon && <s.icon className={`w-4 h-4 ${s.color}`} />}
                  {s.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Chart */}
      <Card className="border-none shadow-[var(--shadow-card)]">
        <CardHeader><CardTitle className="text-base font-semibold">{t.monthlyOverview}</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="incG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(170, 65%, 45%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(170, 65%, 45%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(250, 70%, 58%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(250, 70%, 58%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 45%)" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 45%)" />
                <Tooltip />
                <Area type="monotone" dataKey="income" stroke="hsl(170, 65%, 45%)" fill="url(#incG)" strokeWidth={2} />
                <Area type="monotone" dataKey="expenses" stroke="hsl(250, 70%, 58%)" fill="url(#expG)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card className="border-none shadow-[var(--shadow-card)]">
        <CardHeader><CardTitle className="text-base font-semibold">{t.recentTransactions}</CardTitle></CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-10">
              <Inbox className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{t.noTransactions}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 5).map(tx => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{tx.categories?.icon || '📁'}</span>
                    <div>
                      <p className="text-sm font-medium">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{tx.categories?.name} · {new Date(tx.date).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US')}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${tx.type === 'income' ? 'text-secondary' : 'text-destructive'}`}>
                    {tx.type === 'income' ? '+' : '-'}{fmt(Number(tx.amount))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardHome;
