import { useEffect, useState, useCallback } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { useTheme } from '@/hooks/useTheme';
import { useRole } from '@/hooks/useRole';
import { supabase } from '@/integrations/supabase/client';
import { dashT } from '@/i18n/dashTranslations';
import {
  Wallet, LayoutDashboard, ArrowUpDown, PieChart, BarChart3, Target, FileText,
  Settings, LogOut, Globe, Menu, X, Sun, Moon, CreditCard, Shield,
  Tag, Receipt, Search, Crown, Users, HelpCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K: focus global search
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
    return <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center animate-pulse" style={{ background: 'var(--gradient-primary)' }}>
          <Wallet className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="text-sm text-muted-foreground">Chargement...</span>
      </div>
    </div>;
  }

  if (!user) return null;

  const mainNav = [
    { key: 'dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { key: 'transactions', icon: ArrowUpDown, path: '/dashboard/transactions' },
    { key: 'accounts', icon: CreditCard, path: '/dashboard/accounts' },
    { key: 'categories', icon: Tag, path: '/dashboard/categories' },
    { key: 'budgets', icon: PieChart, path: '/dashboard/budgets' },
    { key: 'forecasts', icon: BarChart3, path: '/dashboard/forecasts' },
    { key: 'savings', icon: Target, path: '/dashboard/savings' },
    { key: 'reports', icon: FileText, path: '/dashboard/reports' },
    { key: 'family', icon: Users, path: '/dashboard/family' },
  ];

  const secondaryNav = [
    { key: 'receipts', icon: Receipt, path: '/dashboard/receipts' },
    { key: 'settings', icon: Settings, path: '/dashboard/settings' },
    { key: 'payment', icon: Crown, path: '/dashboard/payment' },
    { key: 'guide', icon: HelpCircle, path: '/dashboard/guide' },
    ...(isAdmin ? [{ key: 'adminPricing', icon: Shield, path: '/dashboard/admin/pricing' }] : []),
  ];

  const renderNavItem = (item: { key: string; icon: any; path: string }) => {
    const active = location.pathname === item.path;
    return (
      <Link key={item.key} to={item.path} onClick={() => setSidebarOpen(false)}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
          active
            ? 'bg-primary/10 text-primary shadow-sm'
            : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
        }`}>
        <item.icon className="w-[18px] h-[18px]" />
        <span>{t[item.key as keyof typeof t] as string}</span>
        {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />}
      </Link>
    );
  };

  const planColor = userPlan === 'premium' ? 'bg-accent/15 text-accent border-accent/20' :
    userPlan === 'pro' ? 'bg-primary/15 text-primary border-primary/20' :
    'bg-muted text-muted-foreground border-border';

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-[260px] bg-card border-r border-border/50 transform transition-transform lg:translate-x-0 lg:static lg:z-auto flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md" style={{ background: 'var(--gradient-primary)' }}>
              <Wallet className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-extrabold font-display text-base">Budget Planner</span>
          </Link>
          <Button variant="ghost" size="icon" className="lg:hidden rounded-xl" onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Main nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Menu</p>
          {mainNav.map(renderNavItem)}
          
          <div className="my-3 h-px bg-border/50" />
          
          <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Plus</p>
          {secondaryNav.map(renderNavItem)}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-border/50 space-y-1">
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <Crown className="w-4 h-4 text-accent" />
            <Badge variant="outline" className={`text-[10px] font-bold uppercase ${planColor}`}>
              {userPlan || t.freePlan}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="flex-1 justify-start gap-2 text-muted-foreground rounded-xl h-9" onClick={toggleTheme}>
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              <span className="text-xs">{theme === 'light' ? 'Sombre' : 'Clair'}</span>
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground rounded-xl h-9 w-9" onClick={toggleLocale}>
              <Globe className="w-4 h-4" />
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-destructive/80 hover:text-destructive hover:bg-destructive/5 rounded-xl h-9" onClick={() => setLogoutDialogOpen(true)}>
            <LogOut className="w-4 h-4" />
            <span className="text-xs">{t.logout}</span>
          </Button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50 px-4 lg:px-8 h-16 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="lg:hidden rounded-xl" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold font-display">
            {t.welcome}, {profile?.display_name?.split(' ')[0] || 'User'} 👋
          </h1>
          <div className="flex-1" />
          <form onSubmit={handleGlobalSearch} className="hidden sm:flex relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              data-global-search
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              placeholder={`${t.searchGlobal} (Ctrl+K)`}
              className="pl-10 h-9 w-56 rounded-xl border-border/50 bg-muted/50 focus:bg-background"
            />
          </form>
          <NotificationBell />
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
