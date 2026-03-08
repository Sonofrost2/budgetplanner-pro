import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Wallet, LayoutDashboard, ArrowUpDown, PieChart, BarChart3, Target, FileText,
  Settings, LogOut, Plus, TrendingUp, TrendingDown, Globe, Menu, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Dashboard translations
const dashT = {
  fr: {
    dashboard: 'Tableau de bord',
    transactions: 'Transactions',
    budgets: 'Budgets',
    forecasts: 'Prévisions',
    savings: 'Épargne',
    reports: 'Rapports',
    settings: 'Paramètres',
    logout: 'Déconnexion',
    welcome: 'Bonjour',
    totalBalance: 'Solde total',
    income: 'Revenus',
    expenses: 'Dépenses',
    thisMonth: 'Ce mois',
    recentTransactions: 'Transactions récentes',
    noTransactions: 'Aucune transaction encore. Ajoutez votre première !',
    addTransaction: 'Ajouter une transaction',
    monthlyOverview: 'Aperçu mensuel',
  },
  en: {
    dashboard: 'Dashboard',
    transactions: 'Transactions',
    budgets: 'Budgets',
    forecasts: 'Forecasts',
    savings: 'Savings',
    reports: 'Reports',
    settings: 'Settings',
    logout: 'Log out',
    welcome: 'Hello',
    totalBalance: 'Total Balance',
    income: 'Income',
    expenses: 'Expenses',
    thisMonth: 'This month',
    recentTransactions: 'Recent Transactions',
    noTransactions: 'No transactions yet. Add your first one!',
    addTransaction: 'Add transaction',
    monthlyOverview: 'Monthly Overview',
  },
};

const navItems = [
  { key: 'dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { key: 'transactions', icon: ArrowUpDown, path: '/dashboard/transactions' },
  { key: 'budgets', icon: PieChart, path: '/dashboard/budgets' },
  { key: 'forecasts', icon: BarChart3, path: '/dashboard/forecasts' },
  { key: 'savings', icon: Target, path: '/dashboard/savings' },
  { key: 'reports', icon: FileText, path: '/dashboard/reports' },
  { key: 'settings', icon: Settings, path: '/dashboard/settings' },
] as const;

// Mock chart data
const chartData = [
  { name: 'Jan', income: 3200, expenses: 2100 },
  { name: 'Feb', income: 3400, expenses: 2400 },
  { name: 'Mar', income: 3100, expenses: 1900 },
  { name: 'Apr', income: 3600, expenses: 2800 },
  { name: 'May', income: 3500, expenses: 2200 },
  { name: 'Jun', income: 3800, expenses: 2500 },
];

const Dashboard = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const { locale, toggleLocale } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const t = dashT[locale];
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<{ display_name: string | null } | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    // Fetch profile
    supabase.from('profiles').select('display_name').eq('user_id', user.id).single()
      .then(({ data }) => setProfile(data));
    // Fetch recent transactions
    supabase.from('transactions').select('*, categories(name, icon, color)').eq('user_id', user.id)
      .order('date', { ascending: false }).limit(5)
      .then(({ data }) => setTransactions(data || []));
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>;
  }

  if (!user) return null;

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const balance = totalIncome - totalExpenses;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform lg:translate-x-0 lg:static lg:z-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
              <Wallet className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold font-display">BudgetPlan</span>
          </Link>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <nav className="p-3 space-y-1">
          {navItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link key={item.key} to={item.path} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                <item.icon className="w-4 h-4" />
                {t[item.key as keyof typeof t]}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-border space-y-1">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" onClick={toggleLocale}>
            <Globe className="w-4 h-4" />
            {locale === 'fr' ? 'English' : 'Français'}
          </Button>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-destructive hover:text-destructive" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
            {t.logout}
          </Button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-foreground/20 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border px-4 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold font-display">{t.welcome}, {profile?.display_name?.split(' ')[0] || 'User'} 👋</h1>
          </div>
          <Button size="sm" className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }}>
            <Plus className="w-4 h-4 mr-1" />
            {t.addTransaction}
          </Button>
        </header>

        <div className="p-4 lg:p-8 space-y-6">
          {/* Stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-none shadow-[var(--shadow-card)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{t.totalBalance}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{balance.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US', { style: 'currency', currency: 'EUR' })}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t.thisMonth}</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="border-none shadow-[var(--shadow-card)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-secondary" />
                    {t.income}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-secondary">+{totalIncome.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US', { style: 'currency', currency: 'EUR' })}</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="border-none shadow-[var(--shadow-card)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-destructive" />
                    {t.expenses}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-destructive">-{totalExpenses.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US', { style: 'currency', currency: 'EUR' })}</p>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Chart */}
          <Card className="border-none shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="text-base font-semibold">{t.monthlyOverview}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(170, 65%, 45%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(170, 65%, 45%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(250, 70%, 58%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(250, 70%, 58%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 45%)" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(220, 10%, 45%)" />
                    <Tooltip />
                    <Area type="monotone" dataKey="income" stroke="hsl(170, 65%, 45%)" fill="url(#incomeGrad)" strokeWidth={2} />
                    <Area type="monotone" dataKey="expenses" stroke="hsl(250, 70%, 58%)" fill="url(#expenseGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card className="border-none shadow-[var(--shadow-card)]">
            <CardHeader>
              <CardTitle className="text-base font-semibold">{t.recentTransactions}</CardTitle>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">{t.noTransactions}</p>
              ) : (
                <div className="space-y-3">
                  {transactions.map(tx => (
                    <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{tx.categories?.icon || '📁'}</span>
                        <div>
                          <p className="text-sm font-medium">{tx.description}</p>
                          <p className="text-xs text-muted-foreground">{tx.categories?.name} · {new Date(tx.date).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US')}</p>
                        </div>
                      </div>
                      <span className={`text-sm font-semibold ${tx.type === 'income' ? 'text-secondary' : 'text-destructive'}`}>
                        {tx.type === 'income' ? '+' : '-'}{Number(tx.amount).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US', { style: 'currency', currency: 'EUR' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
