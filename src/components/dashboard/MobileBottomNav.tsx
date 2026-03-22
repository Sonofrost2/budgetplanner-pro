import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { LayoutDashboard, ArrowUpDown, PieChart, Target, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const MobileBottomNav = () => {
  const { locale } = useLanguage();
  const location = useLocation();
  const t = dashT[locale];

  const tabs = [
    { key: 'dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { key: 'transactions', icon: ArrowUpDown, path: '/dashboard/transactions' },
    { key: 'budgets', icon: PieChart, path: '/dashboard/budgets' },
    { key: 'savings', icon: Target, path: '/dashboard/savings' },
    { key: 'settings', icon: Settings, path: '/dashboard/settings' },
  ];

  const isActive = (item: { key: string; path: string }) =>
    item.key === 'dashboard' ? location.pathname === '/dashboard' : location.pathname === item.path;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 lg:hidden">
      {/* Blur backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-xl border-t border-border/50" />
      <div className="relative flex items-center justify-around px-2 h-16 pb-safe">
        {tabs.map((tab) => {
          const active = isActive(tab);
          return (
            <Link
              key={tab.key}
              to={tab.path}
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
              {active && (
                <motion.div
                  layoutId="mobile-tab-dot"
                  className="absolute -top-0.5 w-1 h-1 rounded-full"
                  style={{ background: 'var(--gradient-primary)' }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
