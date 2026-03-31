import { useLocation, Link } from 'react-router-dom';
import { useLanguage } from '@/i18n/LanguageContext';
import { ChevronRight, Home } from 'lucide-react';

const routeLabels: Record<string, { fr: string; en: string }> = {
  '': { fr: 'Tableau de bord', en: 'Dashboard' },
  transactions: { fr: 'Transactions', en: 'Transactions' },
  budgets: { fr: 'Budgets', en: 'Budgets' },
  forecasts: { fr: 'Prévisions', en: 'Forecasts' },
  savings: { fr: 'Épargne', en: 'Savings' },
  reports: { fr: 'Rapports', en: 'Reports' },
  settings: { fr: 'Paramètres', en: 'Settings' },
  payment: { fr: 'Abonnement', en: 'Subscription' },
  accounts: { fr: 'Comptes', en: 'Accounts' },
  categories: { fr: 'Catégories', en: 'Categories' },
  receipts: { fr: 'Reçus', en: 'Receipts' },
  family: { fr: 'Famille', en: 'Family' },
  debts: { fr: 'Dettes', en: 'Debts' },
  recurring: { fr: 'Récurrences', en: 'Recurring' },
  wealth: { fr: 'Patrimoine', en: 'Wealth' },
  guide: { fr: 'Guide', en: 'Guide' },
};

const DashboardBreadcrumb = () => {
  const { locale } = useLanguage();
  const location = useLocation();

  const segments = location.pathname.replace('/dashboard', '').split('/').filter(Boolean);
  if (segments.length === 0) return null;

  const currentSegment = segments[segments.length - 1];
  const label = routeLabels[currentSegment]?.[locale] || currentSegment;

  return (
    <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Link to="/dashboard" className="hover:text-foreground transition-colors flex items-center gap-1">
        <Home className="w-3 h-3" />
        <span className="hidden sm:inline">{routeLabels[''][locale]}</span>
      </Link>
      <ChevronRight className="w-3 h-3" />
      <span className="text-foreground font-medium">{label}</span>
    </nav>
  );
};

export default DashboardBreadcrumb;
