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
  Settings, LogOut, Menu, X, Sun, Moon, CreditCard, Shield,
  Tag, Receipt, Search, Crown, Users, Landmark, RefreshCw, Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { TopLoadingBar } from '@/components/ui/top-loading-bar';
import { NotificationBell } from '@/components/dashboard/NotificationBell';
import { OfflineBanner } from '@/components/dashboard/OfflineBanner';
import ConfirmDeleteDialog from '@/components/dashboard/ConfirmDeleteDialog';

const DashboardLayout = () => {
  const { user, signOut, loading: authLoading } = useAuth();
  const { locale, toggleLocale } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { isAdmin } = useRole();
  const navigate = useNavigate();
  const location = useLocation();
  const t = dashT[locale];
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
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
    supabase.from('subscriptions').select('status, subscription_plans(name)').eq('user_id', user.id).eq('status', 'active')
      .order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setUserPlan((data[0] as any).subscription_plans?.name || null);
        } else {
          setUserPlan(null);
        }
      });
  }, [user, navigate]);

  const handleLogout = async () => {
    setLogoutDialogOpen(false);
    await signOut();
    navigate('/');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>('[data-global-search]');
        searchInput?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (globalSearch.trim()) {
      navigate(`/dashboard/transactions?q=${encodeURIComponent(globalSearch.trim())}`);
      setGlobalSearch('');
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center mesh-bg">
      <div className="flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center animate-pulse" style={{ background: 'var(--gradient-primary)' }}>
          <Wallet className="w-6 h-6 text-primary-foreground" />
        </div>
        <span className="text-sm text-muted-foreground font-medium">Chargement...</span>
      </div>
    </div>;
  }

  if (!user) return null;

  const navGroups = [
    {
      label: locale === 'fr' ? 'Principal' : 'Main',
      items: [
        { key: 'dashboard', icon: LayoutDashboard, path: '/dashboard' },
        { key: 'transactions', icon: ArrowUpDown, path: '/dashboard/transactions' },
        { key: 'accounts', icon: CreditCard, path: '/dashboard/accounts' },
        { key: 'budgets', icon: PieChart, path: '/dashboard/budgets' },
      ],
    },
    {
      label: locale === 'fr' ? 'Gestion' : 'Management',
      items: [
        { key: 'savings', icon: Target, path: '/dashboard/savings' },
        { key: 'recurring', icon: RefreshCw, path: '/dashboard/recurring' },
        { key: 'categories', icon: Tag, path: '/dashboard/categories' },
      ],
    },
    {
      label: locale === 'fr' ? 'Analyse' : 'Analytics',
      items: [
        { key: 'forecasts', icon: BarChart3, path: '/dashboard/forecasts' },
        { key: 'reports', icon: FileText, path: '/dashboard/reports' },
        { key: 'family', icon: Users, path: '/dashboard/family' },
      ],
    },
    {
      label: locale === 'fr' ? 'Paramètres' : 'Settings',
      items: [
        { key: 'receipts', icon: Receipt, path: '/dashboard/receipts' },
        { key: 'payment', icon: Crown, path: '/dashboard/payment' },
        { key: 'settings', icon: Settings, path: '/dashboard/settings' },
        ...(isAdmin ? [{ key: 'adminPricing', icon: Shield, path: '/dashboard/admin/pricing' }] : []),
      ],
    },
  ];

  const renderNavItem = (item: { key: string; icon: any; path: string }) => {
    const active = location.pathname === item.path || (item.path === '/dashboard' && location.pathname === '/dashboard');
    const isExactDashboard = item.key === 'dashboard';
    const isActive = isExactDashboard ? location.pathname === '/dashboard' : location.pathname === item.path;

    return (
      <Link key={item.key} to={item.path} onClick={() => setSidebarOpen(false)}
        className={`group flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 ${
          isActive
            ? 'glass text-primary shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
        }`}>
        <item.icon className={`w-[16px] h-[16px] transition-colors ${isActive ? 'text-primary' : 'group-hover:text-foreground'}`} />
        <span>{t[item.key as keyof typeof t] as string}</span>
        {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: 'var(--gradient-primary)' }} />}
      </Link>
    );
  };

  const planColor = userPlan === 'premium' ? 'bg-accent/15 text-accent border-accent/20' :
    userPlan === 'pro' ? 'bg-primary/15 text-primary border-primary/20' :
    'bg-muted/60 text-muted-foreground border-border';

  return (
    <div className="min-h-screen mesh-bg flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[240px] glass-strong transform transition-transform lg:translate-x-0 lg:static lg:z-auto flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-glass-border">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-md" style={{ background: 'var(--gradient-primary)' }}>
              <Wallet className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold font-display text-sm tracking-tight">Budget Planner</span>
          </Link>
          <Button variant="ghost" size="icon" className="lg:hidden rounded-xl h-7 w-7" onClick={() => setSidebarOpen(false)}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 p-2.5 space-y-4 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map(renderNavItem)}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-2.5 border-t border-glass-border space-y-1">
          <div className="flex items-center gap-2 px-3 py-1.5">
            <Badge variant="outline" className={`text-[9px] font-bold uppercase ${planColor}`}>
              {userPlan || t.freePlan}
            </Badge>
          </div>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="sm" className="flex-1 justify-start gap-2 text-muted-foreground rounded-xl h-8 text-xs" onClick={toggleTheme}>
              {theme === 'light' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
              <span>{theme === 'light' ? 'Sombre' : 'Clair'}</span>
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground rounded-xl h-8 w-8" onClick={toggleLocale}>
              <Globe className="w-3.5 h-3.5" />
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-destructive/70 hover:text-destructive hover:bg-destructive/5 rounded-xl h-8 text-xs" onClick={() => setLogoutDialogOpen(true)}>
            <LogOut className="w-3.5 h-3.5" />
            <span>{t.logout}</span>
          </Button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-foreground/10 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 glass border-b border-glass-border px-4 lg:px-6 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="lg:hidden rounded-xl h-8 w-8" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-4 h-4" />
          </Button>
          <h1 className="text-sm font-semibold font-display truncate">
            {t.welcome}, {profile?.display_name?.split(' ')[0] || 'User'} 👋
          </h1>
          <div className="flex-1" />
          <form onSubmit={handleGlobalSearch} className="hidden sm:flex relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              data-global-search
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              placeholder={`${t.searchGlobal} (⌘K)`}
              className="pl-9 h-8 w-52 rounded-xl border-glass-border bg-glass text-xs focus:bg-background"
            />
          </form>
          <NotificationBell />
        </header>

        <div className="p-4 lg:p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <OfflineBanner />

      <ConfirmDeleteDialog
        open={logoutDialogOpen}
        onOpenChange={setLogoutDialogOpen}
        onConfirm={handleLogout}
        title={locale === 'fr' ? 'Déconnexion' : 'Log out'}
        description={locale === 'fr' ? 'Êtes-vous sûr de vouloir vous déconnecter ?' : 'Are you sure you want to log out?'}
        cancelLabel={t.cancel}
        confirmLabel={t.logout}
      />
    </div>
  );
};

export default DashboardLayout;
