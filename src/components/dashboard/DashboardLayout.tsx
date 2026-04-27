import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/integrations/supabase/client';
import { dashT } from '@/i18n/dashTranslations';
import { Wallet, Menu, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { TopLoadingBar } from '@/components/ui/top-loading-bar';
import { NotificationBell } from '@/components/dashboard/NotificationBell';
import { OfflineBanner } from '@/components/dashboard/OfflineBanner';
import ConfirmDeleteDialog from '@/components/dashboard/ConfirmDeleteDialog';
import AIChatWidget from '@/components/dashboard/AIChatWidget';
import GlobalSearchCommand from '@/components/dashboard/GlobalSearchCommand';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';
import { useDeviceFingerprint } from '@/hooks/useDeviceFingerprint';
import { PWAUpdatePrompt } from '@/components/dashboard/PWAUpdatePrompt';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import AppSidebar from '@/components/dashboard/AppSidebar';
import MobileBottomNav from '@/components/dashboard/MobileBottomNav';
import DashboardBreadcrumb from '@/components/dashboard/Breadcrumb';
import DemoBanner from '@/components/dashboard/DemoBanner';
import { isDemoUserEmail } from '@/lib/demo';

const DashboardLayout = () => {
  useRealtimeSync();
  useDeviceFingerprint();
  const { user, signOut, loading: authLoading } = useAuth();
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const t = dashT[locale];
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [profile, setProfile] = useState<{ display_name: string | null; onboarding_completed: boolean; avatar_url: string | null } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    // Demo account skips onboarding regardless of DB flag
    if (isDemoUserEmail(user.email)) {
      setProfile({ display_name: 'Compte Démo', onboarding_completed: true, avatar_url: null });
      setUserPlan(null);
      return;
    }
    supabase.from('profiles').select('display_name, onboarding_completed, avatar_url').eq('user_id', user.id).single()
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
    setPageLoading(true);
    const timer = setTimeout(() => setPageLoading(false), 600);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  // ⌘K + g+x shortcuts
  useEffect(() => {
    let lastG = 0;
    const goMap: Record<string, string> = {
      t: '/dashboard/transactions',
      b: '/dashboard/budgets',
      s: '/dashboard/savings',
      a: '/dashboard/accounts',
      r: '/dashboard/reports',
      d: '/dashboard',
      w: '/dashboard/wealth',
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const now = Date.now();
      if (e.key === 'g') { lastG = now; return; }
      if (now - lastG < 800 && goMap[e.key]) {
        e.preventDefault();
        navigate(goMap[e.key]);
        lastG = 0;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center mesh-bg">
        <div className="flex flex-col items-center gap-4">
          <motion.div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
            style={{ background: 'var(--gradient-primary)' }}
            animate={{ scale: [1, 1.08, 1], rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Wallet className="w-7 h-7 text-primary-foreground" />
          </motion.div>
          <div className="flex flex-col items-center gap-2">
            <motion.span
              className="text-sm text-muted-foreground font-medium"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              Chargement...
            </motion.span>
            <div className="w-32 h-1 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: 'var(--gradient-primary)' }}
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <SidebarProvider>
      <div className="min-h-screen mesh-bg flex w-full">
        <TopLoadingBar loading={pageLoading} />

        {/* Sidebar — hidden on mobile, uses shadcn collapsible on desktop */}
        <div className="hidden lg:block">
          <AppSidebar
            profile={profile}
            userPlan={userPlan}
            userEmail={user?.email || null}
            onLogout={() => setLogoutDialogOpen(true)}
            onSearchOpen={() => setSearchOpen(true)}
          />
        </div>

        {/* Main content */}
        <main className="flex-1 min-w-0 pb-20 lg:pb-0">
          <DemoBanner />
          <header className="sticky top-0 z-30 bg-background/60 backdrop-blur-xl border-b border-border/50 px-4 lg:px-6 h-14 flex items-center gap-3">
            {/* Sidebar toggle — desktop only */}
            <SidebarTrigger className="hidden lg:flex h-8 w-8 rounded-xl" />

            <div className="flex flex-col min-w-0">
              <h1 className="text-sm font-semibold font-display truncate">
                {t.welcome}, {profile?.display_name?.split(' ')[0] || 'User'} 👋
              </h1>
              <DashboardBreadcrumb />
            </div>
            <div className="flex-1" />

            {/* Search trigger */}
            <button
              onClick={() => setSearchOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 h-8 rounded-xl border border-border/50 bg-background/50 text-xs text-muted-foreground hover:bg-background transition-colors w-52"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="flex-1 text-left truncate">{locale === 'fr' ? 'Rechercher...' : 'Search...'}</span>
              <kbd className="hidden md:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                ⌘K
              </kbd>
            </button>
            {/* Mobile search icon */}
            <Button variant="ghost" size="icon" className="sm:hidden rounded-xl h-8 w-8" onClick={() => setSearchOpen(true)}>
              <Search className="w-4 h-4" />
            </Button>

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

        {/* Mobile bottom nav */}
        <MobileBottomNav />

        <OfflineBanner />
        <PWAUpdatePrompt />
        <AIChatWidget />
        <GlobalSearchCommand open={searchOpen} onOpenChange={setSearchOpen} />

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
    </SidebarProvider>
  );
};

export default DashboardLayout;
