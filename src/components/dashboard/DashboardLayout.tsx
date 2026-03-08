import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { useTheme } from '@/hooks/useTheme';
import { useRole } from '@/hooks/useRole';
import { supabase } from '@/integrations/supabase/client';
import { dashT } from '@/i18n/dashTranslations';
import {
  Wallet, LayoutDashboard, ArrowUpDown, PieChart, BarChart3, Target, FileText,
  Settings, LogOut, Globe, Menu, X, Sun, Moon, Smartphone, CreditCard, Shield,
  Tag, Receipt, Search, Crown, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

const DashboardLayout = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const { locale, toggleLocale } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { isAdmin } = useRole();
  const navigate = useNavigate();
  const location = useLocation();
  const t = dashT[locale];
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<{ display_name: string | null; onboarding_completed: boolean } | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [userPlan, setUserPlan] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('display_name, onboarding_completed').eq('user_id', user.id).single()
      .then(({ data }) => {
        setProfile(data);
        if (data && !data.onboarding_completed) navigate('/onboarding');
      });
    // Check user plan
    supabase.from('payment_receipts').select('plan_name').eq('user_id', user.id).eq('status', 'confirmed')
      .order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => {
        setUserPlan(data && data.length > 0 ? data[0].plan_name : null);
      });
  }, [user, navigate]);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (globalSearch.trim()) {
      navigate(`/dashboard/transactions?q=${encodeURIComponent(globalSearch.trim())}`);
      setGlobalSearch('');
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>;
  }

  if (!user) return null;

  const navItems = [
    { key: 'dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { key: 'transactions', icon: ArrowUpDown, path: '/dashboard/transactions' },
    { key: 'accounts', icon: CreditCard, path: '/dashboard/accounts' },
    { key: 'categories', icon: Tag, path: '/dashboard/categories' },
    { key: 'budgets', icon: PieChart, path: '/dashboard/budgets' },
    { key: 'forecasts', icon: BarChart3, path: '/dashboard/forecasts' },
    { key: 'savings', icon: Target, path: '/dashboard/savings' },
    { key: 'reports', icon: FileText, path: '/dashboard/reports' },
    { key: 'receipts', icon: Receipt, path: '/dashboard/receipts' },
    { key: 'settings', icon: Settings, path: '/dashboard/settings' },
    { key: 'payment', icon: Smartphone, path: '/dashboard/payment' },
    ...(isAdmin ? [{ key: 'adminPricing', icon: Shield, path: '/dashboard/admin/pricing' }] : []),
  ];

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform lg:translate-x-0 lg:static lg:z-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
              <Wallet className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold font-display">Budget Planner</span>
          </Link>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <nav className="p-3 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
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
          {/* Plan badge */}
          <div className="flex items-center gap-2 px-3 py-2">
            <Crown className="w-4 h-4 text-accent" />
            <Badge variant="secondary" className="text-xs">
              {userPlan || t.freePlan}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" onClick={toggleTheme}>
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            {theme === 'light' ? (locale === 'fr' ? 'Mode sombre' : 'Dark mode') : (locale === 'fr' ? 'Mode clair' : 'Light mode')}
          </Button>
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

      {sidebarOpen && <div className="fixed inset-0 bg-foreground/20 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border px-4 lg:px-8 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold font-display">{t.welcome}, {profile?.display_name?.split(' ')[0] || 'User'} 👋</h1>
          <div className="flex-1" />
          <form onSubmit={handleGlobalSearch} className="hidden sm:flex relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              placeholder={t.searchGlobal}
              className="pl-10 h-9 w-64"
            />
          </form>
        </header>

        <div className="p-4 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
