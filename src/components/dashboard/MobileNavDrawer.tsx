import { Link, useLocation } from 'react-router-dom';
import { useLanguage } from '@/i18n/LanguageContext';
import { useRole } from '@/hooks/useRole';
import { dashT } from '@/i18n/dashTranslations';
import {
  LayoutDashboard, ArrowUpDown, PieChart, BarChart3, Target, FileText,
  Settings, CreditCard, Tag, Receipt, Crown, Users, Landmark, RefreshCw,
  Gem, Compass, LineChart, Building2, BookOpen, Bell, Link2, Lock, Shield,
  LogOut, Search, Wallet,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useNavBadges } from '@/hooks/useNavBadges';

interface NavItem {
  key: string;
  icon: any;
  path: string;
  badge?: 'transactionsToday' | 'budgetsExceeded' | 'debtsOverdue';
  requiredPlan?: 'pro' | 'premium';
}

interface NavGroup {
  id: string;
  labelKey: 'operations' | 'treasury' | 'piloting' | 'analysis' | 'organization';
  icon: any;
  items: NavItem[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: { display_name: string | null; avatar_url: string | null } | null;
  userPlan: string | null;
  userEmail: string | null;
  onLogout: () => void;
  onSearchOpen: () => void;
}

const MobileNavDrawer = ({ open, onOpenChange, profile, userPlan, userEmail, onLogout, onSearchOpen }: Props) => {
  const { locale } = useLanguage();
  const { isAdmin } = useRole();
  const location = useLocation();
  const t = dashT[locale];
  const { data: badges } = useNavBadges();

  const planRank = (p: string | null | undefined) => p === 'premium' ? 2 : p === 'pro' ? 1 : 0;
  const userRank = isAdmin ? 2 : planRank(userPlan);
  const isLocked = (item: NavItem) => !!item.requiredPlan && userRank < planRank(item.requiredPlan);

  const homeItem: NavItem = { key: 'dashboard', icon: LayoutDashboard, path: '/dashboard' };

  const groups: NavGroup[] = [
    {
      id: 'operations', labelKey: 'operations', icon: ArrowUpDown,
      items: [
        { key: 'transactions', icon: ArrowUpDown, path: '/dashboard/transactions', badge: 'transactionsToday' },
        { key: 'recurring', icon: RefreshCw, path: '/dashboard/recurring', requiredPlan: 'pro' },
        { key: 'receipts', icon: Receipt, path: '/dashboard/receipts', requiredPlan: 'premium' },
      ],
    },
    {
      id: 'treasury', labelKey: 'treasury', icon: Building2,
      items: [
        { key: 'accounts', icon: CreditCard, path: '/dashboard/accounts' },
        { key: 'wealth', icon: Gem, path: '/dashboard/wealth', requiredPlan: 'premium' },
        { key: 'debts', icon: Landmark, path: '/dashboard/debts', badge: 'debtsOverdue', requiredPlan: 'pro' },
      ],
    },
    {
      id: 'piloting', labelKey: 'piloting', icon: Compass,
      items: [
        { key: 'budgets', icon: PieChart, path: '/dashboard/budgets', badge: 'budgetsExceeded' },
        { key: 'savings', icon: Target, path: '/dashboard/savings' },
        { key: 'budgetSavingsLinks', icon: Link2, path: '/dashboard/links', requiredPlan: 'pro' },
        { key: 'forecasts', icon: BarChart3, path: '/dashboard/forecasts', requiredPlan: 'premium' },
      ],
    },
    {
      id: 'analysis', labelKey: 'analysis', icon: LineChart,
      items: [
        { key: 'reports', icon: FileText, path: '/dashboard/reports', requiredPlan: 'pro' },
        { key: 'categories', icon: Tag, path: '/dashboard/categories' },
      ],
    },
    {
      id: 'organization', labelKey: 'organization', icon: Users,
      items: [
        { key: 'family', icon: Users, path: '/dashboard/family', requiredPlan: 'premium' },
        { key: 'payment', icon: Crown, path: '/dashboard/payment' },
        { key: 'settings', icon: Settings, path: '/dashboard/settings' },
        { key: 'notifications', icon: Bell, path: '/dashboard/notifications' },
        { key: 'guide', icon: BookOpen, path: '/dashboard/guide' },
        ...(isAdmin ? [
          { key: 'adminUsers', icon: Users, path: '/dashboard/admin/users' } as NavItem,
          { key: 'adminSecurity', icon: Shield, path: '/dashboard/admin/security' } as NavItem,
        ] : []),
      ],
    },
  ];

  const isActive = (item: NavItem) =>
    item.key === 'dashboard' ? location.pathname === '/dashboard' : location.pathname === item.path;

  const displayName = profile?.display_name || 'User';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const close = () => onOpenChange(false);

  const renderItem = (item: NavItem) => {
    const active = isActive(item);
    const label = (t[item.key as keyof typeof t] as string) || item.key;
    const badgeVal = item.badge && badges ? (badges[item.badge] || 0) : 0;
    const locked = isLocked(item);
    const planBadge = item.requiredPlan === 'premium' ? 'Premium' : item.requiredPlan === 'pro' ? 'Pro' : null;

    return (
      <Link
        key={item.key}
        to={locked ? '/dashboard/payment' : item.path}
        onClick={close}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'group relative flex items-center gap-3 px-3 h-11 rounded-xl text-sm font-medium transition-colors',
          active && !locked
            ? 'bg-primary/10 text-primary'
            : 'text-foreground/80 hover:bg-muted/60 active:bg-muted'
        )}
      >
        {active && !locked && (
          <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary" aria-hidden />
        )}
        <span className={cn(
          'flex items-center justify-center w-8 h-8 rounded-lg shrink-0',
          active && !locked ? 'bg-primary/15 text-primary' : 'text-muted-foreground'
        )}>
          <item.icon className="w-4 h-4" />
        </span>
        <span className={cn('truncate flex-1 text-left', locked && 'text-muted-foreground/70')}>{label}</span>
        {locked && planBadge && (
          <Badge variant="outline" className={cn(
            'h-5 px-1.5 text-[9px] font-bold uppercase tracking-wider gap-0.5',
            item.requiredPlan === 'premium'
              ? 'border-accent/40 bg-accent/10 text-accent'
              : 'border-primary/40 bg-primary/10 text-primary'
          )}>
            <Lock className="w-2.5 h-2.5" />
            {planBadge}
          </Badge>
        )}
        {!locked && badgeVal > 0 && (
          <Badge className={cn(
            'h-5 min-w-[20px] px-1.5 text-[10px] font-bold border-0',
            item.badge === 'budgetsExceeded' || item.badge === 'debtsOverdue'
              ? 'bg-destructive/15 text-destructive'
              : 'bg-primary/15 text-primary'
          )}>
            {badgeVal > 99 ? '99+' : badgeVal}
          </Badge>
        )}
      </Link>
    );
  };

  const planColor = userPlan === 'premium' ? 'bg-accent/15 text-accent border-accent/20' :
    userPlan === 'pro' ? 'bg-primary/15 text-primary border-primary/20' :
    'bg-muted/60 text-muted-foreground border-border';
  const planLabel = userPlan === 'premium' ? 'Premium' : userPlan === 'pro' ? 'Pro' : (locale === 'fr' ? 'Gratuit' : 'Free');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[85vw] max-w-[340px] p-0 flex flex-col gap-0 bg-background border-r border-border/60"
      >
        <SheetHeader className="p-4 pb-3 border-b border-border/50 space-y-3 text-left">
          <SheetTitle className="flex items-center gap-2.5 text-base font-display">
            <span
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md shrink-0"
              style={{ background: 'var(--gradient-primary)' }}
            >
              <Wallet className="w-5 h-5 text-primary-foreground" />
            </span>
            <span className="truncate">Budget Planner</span>
          </SheetTitle>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-semibold text-muted-foreground">{initials || '?'}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{displayName}</p>
              <p className="text-[11px] text-muted-foreground truncate">{userEmail}</p>
            </div>
            <Badge variant="outline" className={cn('h-5 px-2 text-[10px] font-bold uppercase tracking-wider', planColor)}>
              {planLabel}
            </Badge>
          </div>

          <button
            onClick={() => { close(); onSearchOpen(); }}
            className="w-full flex items-center gap-2 px-3 h-9 rounded-xl border border-border/50 bg-muted/40 text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">{locale === 'fr' ? 'Rechercher...' : 'Search...'}</span>
          </button>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0">
          <nav className="p-3 space-y-4" aria-label={locale === 'fr' ? 'Navigation principale' : 'Main navigation'}>
            <div className="space-y-1">
              {renderItem(homeItem)}
            </div>
            {groups.map(group => (
              <div key={group.id} className="space-y-1">
                <div className="flex items-center gap-2 px-3 pt-1">
                  <group.icon className="w-3 h-3 text-muted-foreground/70" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    {t[group.labelKey] as string}
                  </span>
                </div>
                <div className="space-y-0.5">
                  {group.items.map(renderItem)}
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>

        <Separator />
        <div className="p-3">
          <button
            onClick={() => { close(); onLogout(); }}
            className="w-full flex items-center gap-3 px-3 h-11 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-destructive/10 shrink-0">
              <LogOut className="w-4 h-4" />
            </span>
            <span>{t.logout}</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileNavDrawer;