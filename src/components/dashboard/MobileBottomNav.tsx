import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import {
  LayoutDashboard, ArrowUpDown, PieChart, Target, MoreHorizontal,
  Settings, CreditCard, Tag, Landmark, RefreshCw, BarChart3, FileText,
  Receipt, Crown, Users, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const MobileBottomNav = () => {
  const { locale } = useLanguage();
  const location = useLocation();
  const t = dashT[locale];
  const [moreOpen, setMoreOpen] = useState(false);

  const mainTabs = [
    { key: 'dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { key: 'transactions', icon: ArrowUpDown, path: '/dashboard/transactions' },
    { key: 'budgets', icon: PieChart, path: '/dashboard/budgets' },
    { key: 'savings', icon: Target, path: '/dashboard/savings' },
  ];

  const moreItems = [
    { key: 'accounts', icon: CreditCard, path: '/dashboard/accounts' },
    { key: 'categories', icon: Tag, path: '/dashboard/categories' },
    { key: 'debts', icon: Landmark, path: '/dashboard/debts' },
    { key: 'recurring', icon: RefreshCw, path: '/dashboard/recurring' },
    { key: 'forecasts', icon: BarChart3, path: '/dashboard/forecasts' },
    { key: 'reports', icon: FileText, path: '/dashboard/reports' },
    { key: 'family', icon: Users, path: '/dashboard/family' },
    { key: 'receipts', icon: Receipt, path: '/dashboard/receipts' },
    { key: 'payment', icon: Crown, path: '/dashboard/payment' },
    { key: 'settings', icon: Settings, path: '/dashboard/settings' },
  ];

  const isActive = (item: { key: string; path: string }) =>
    item.key === 'dashboard' ? location.pathname === '/dashboard' : location.pathname === item.path;

  const isMoreActive = moreItems.some(item => isActive(item));

  return (
    <>
      {/* Overlay */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm lg:hidden"
            onClick={() => setMoreOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* More menu panel */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="fixed bottom-16 inset-x-0 z-50 lg:hidden px-3 pb-2"
          >
            <div className="bg-card border border-border/50 rounded-2xl shadow-lg p-3 space-y-1">
              <div className="flex items-center justify-between px-2 mb-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {locale === 'fr' ? 'Tous les modules' : 'All modules'}
                </span>
                <button onClick={() => setMoreOpen(false)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {moreItems.map(item => {
                  const active = isActive(item);
                  return (
                    <Link
                      key={item.key}
                      to={item.path}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        'flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl transition-all text-center',
                        active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted/50'
                      )}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="text-[10px] font-medium leading-tight line-clamp-1">
                        {t[item.key as keyof typeof t] as string}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 inset-x-0 z-50 lg:hidden">
        <div className="absolute inset-0 bg-background/80 backdrop-blur-xl border-t border-border/50" />
        <div className="relative flex items-center justify-around px-2 h-16 pb-safe">
          {mainTabs.map((tab) => {
            const active = isActive(tab);
            return (
              <Link
                key={tab.key}
                to={tab.path}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  'relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl transition-all duration-200',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {active && (
                  <motion.div
                    layoutId="mobile-tab-bg"
                    className="absolute inset-0 rounded-2xl bg-primary/10"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <tab.icon className={cn('w-5 h-5 relative z-10 transition-transform', active && 'scale-110')} />
                <span className="text-[10px] font-medium relative z-10 leading-tight">
                  {t[tab.key as keyof typeof t] as string}
                </span>
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setMoreOpen(o => !o)}
            className={cn(
              'relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl transition-all duration-200',
              (moreOpen || isMoreActive) ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            {(moreOpen || isMoreActive) && (
              <motion.div
                layoutId="mobile-tab-bg"
                className="absolute inset-0 rounded-2xl bg-primary/10"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <MoreHorizontal className={cn('w-5 h-5 relative z-10 transition-transform', moreOpen && 'scale-110')} />
            <span className="text-[10px] font-medium relative z-10 leading-tight">
              {locale === 'fr' ? 'Plus' : 'More'}
            </span>
          </button>
        </div>
      </nav>
    </>
  );
};

export default MobileBottomNav;
