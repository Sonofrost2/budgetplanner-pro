import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import {
  LayoutDashboard, ArrowUpDown, PieChart, Target, Menu,
  Settings, CreditCard, Tag, Landmark, RefreshCw, BarChart3, FileText,
  Receipt, Crown, Users, Gem,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface Props {
  onMoreClick: () => void;
  moreOpen?: boolean;
}

const MobileBottomNav = ({ onMoreClick, moreOpen = false }: Props) => {
  const { locale } = useLanguage();
  const location = useLocation();
  const t = dashT[locale];

  const mainTabs = [
    { key: 'dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { key: 'transactions', icon: ArrowUpDown, path: '/dashboard/transactions' },
    { key: 'budgets', icon: PieChart, path: '/dashboard/budgets' },
    { key: 'savings', icon: Target, path: '/dashboard/savings' },
  ];

  const moreItems = [
    { key: 'accounts', icon: CreditCard, path: '/dashboard/accounts' },
    { key: 'wealth', icon: Gem, path: '/dashboard/wealth' },
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
    <nav className="fixed bottom-0 inset-x-0 z-40 lg:hidden" aria-label={locale === 'fr' ? 'Navigation rapide' : 'Quick navigation'}>
        <div className="absolute inset-0 bg-background/80 backdrop-blur-xl border-t border-border/50" />
        <div className="relative flex items-center justify-around px-2 h-16 pb-safe">
          {mainTabs.map((tab) => {
            const active = isActive(tab);
            return (
              <Link
                key={tab.key}
                to={tab.path}
                aria-current={active ? 'page' : undefined}
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

          {/* More button — opens the drawer */}
          <button
            onClick={onMoreClick}
            aria-label={locale === 'fr' ? 'Ouvrir le menu' : 'Open menu'}
            aria-expanded={moreOpen}
            aria-controls="mobile-nav-drawer"
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
            <Menu className={cn('w-5 h-5 relative z-10 transition-transform', moreOpen && 'scale-110')} />
            <span className="text-[10px] font-medium relative z-10 leading-tight">
              {locale === 'fr' ? 'Menu' : 'Menu'}
            </span>
          </button>
        </div>
    </nav>
  );
};

export default MobileBottomNav;
