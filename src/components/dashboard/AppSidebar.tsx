import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/i18n/LanguageContext';
import { useTheme } from '@/hooks/useTheme';
import { useRole } from '@/hooks/useRole';
import { dashT } from '@/i18n/dashTranslations';
import {
  Wallet, LayoutDashboard, ArrowUpDown, PieChart, BarChart3, Target, FileText,
  Settings, LogOut, Sun, Moon, Monitor, CreditCard, Shield,
  Tag, Receipt, Search, Crown, Users, Globe,
  Sparkles, User, ChevronUp, Landmark, RefreshCw, Gem,
  Wallet2, Compass, LineChart, Building2, BookOpen, MessageCircle,
  Star, ChevronDown, Pin,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { usePinnedNav } from '@/hooks/usePinnedNav';
import { useNavBadges } from '@/hooks/useNavBadges';

interface AppSidebarProps {
  profile: { display_name: string | null; avatar_url: string | null } | null;
  userPlan: string | null;
  userEmail: string | null;
  onLogout: () => void;
  onSearchOpen: () => void;
}

interface NavItem {
  key: string;
  icon: any;
  path: string;
  badge?: 'transactionsToday' | 'budgetsExceeded' | 'debtsOverdue';
}

interface NavGroup {
  id: string;
  labelKey: 'operations' | 'treasury' | 'piloting' | 'analysis' | 'organization';
  icon: any;
  items: NavItem[];
}

const AppSidebar = ({ profile, userPlan, userEmail, onLogout, onSearchOpen }: AppSidebarProps) => {
  const { locale, toggleLocale } = useLanguage();
  const { mode, setMode } = useTheme();
  const { isAdmin } = useRole();
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const t = dashT[locale];
  const [profilePopoverOpen, setProfilePopoverOpen] = useState(false);
  const { pinned, isPinned, togglePin } = usePinnedNav();
  const { data: badges } = useNavBadges();

  const displayName = profile?.display_name || 'User';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const homeItem: NavItem = { key: 'dashboard', icon: LayoutDashboard, path: '/dashboard' };

  const groups: NavGroup[] = [
    {
      id: 'operations',
      labelKey: 'operations',
      icon: ArrowUpDown,
      items: [
        { key: 'transactions', icon: ArrowUpDown, path: '/dashboard/transactions', badge: 'transactionsToday' },
        { key: 'recurring', icon: RefreshCw, path: '/dashboard/recurring' },
        { key: 'receipts', icon: Receipt, path: '/dashboard/receipts' },
      ],
    },
    {
      id: 'treasury',
      labelKey: 'treasury',
      icon: Building2,
      items: [
        { key: 'accounts', icon: CreditCard, path: '/dashboard/accounts' },
        { key: 'wealth', icon: Gem, path: '/dashboard/wealth' },
        { key: 'debts', icon: Landmark, path: '/dashboard/debts', badge: 'debtsOverdue' },
      ],
    },
    {
      id: 'piloting',
      labelKey: 'piloting',
      icon: Compass,
      items: [
        { key: 'budgets', icon: PieChart, path: '/dashboard/budgets', badge: 'budgetsExceeded' },
        { key: 'savings', icon: Target, path: '/dashboard/savings' },
        { key: 'forecasts', icon: BarChart3, path: '/dashboard/forecasts' },
      ],
    },
    {
      id: 'analysis',
      labelKey: 'analysis',
      icon: LineChart,
      items: [
        { key: 'reports', icon: FileText, path: '/dashboard/reports' },
        { key: 'categories', icon: Tag, path: '/dashboard/categories' },
      ],
    },
    {
      id: 'organization',
      labelKey: 'organization',
      icon: Users,
      items: [
        { key: 'family', icon: Users, path: '/dashboard/family' },
        { key: 'payment', icon: Crown, path: '/dashboard/payment' },
        { key: 'settings', icon: Settings, path: '/dashboard/settings' },
        { key: 'guide', icon: BookOpen, path: '/dashboard/guide' },
        ...(isAdmin ? [
          { key: 'adminPricing', icon: Shield, path: '/dashboard/admin/pricing' },
          { key: 'adminUsers', icon: Users, path: '/dashboard/admin/users' },
          { key: 'adminSecurity', icon: Shield, path: '/dashboard/admin/security' },
        ] : []),
      ],
    },
  ];

  // Flatten all items for pinned lookup
  const allItems: NavItem[] = [homeItem, ...groups.flatMap(g => g.items)];
  const pinnedItems = pinned
    .map(p => allItems.find(i => i.path === p))
    .filter(Boolean) as NavItem[];

  const isActive = (item: NavItem) =>
    item.key === 'dashboard' ? location.pathname === '/dashboard' : location.pathname === item.path;

  const getBadgeValue = (item: NavItem): number => {
    if (!item.badge || !badges) return 0;
    return badges[item.badge] || 0;
  };

  const planColor = userPlan === 'premium' ? 'bg-accent/15 text-accent border-accent/20' :
    userPlan === 'pro' ? 'bg-primary/15 text-primary border-primary/20' :
    'bg-muted/60 text-muted-foreground border-border';

  // Render a single nav row (used in pinned, recent, home, groups)
  const renderItem = (item: NavItem, options: { showPin?: boolean; compact?: boolean } = {}) => {
    const active = isActive(item);
    const label = (t[item.key as keyof typeof t] as string) || item.key;
    const badgeVal = getBadgeValue(item);
    const pinnedNow = isPinned(item.path);

    return (
      <SidebarMenuItem key={item.path}>
        <SidebarMenuButton
          asChild
          isActive={active}
          tooltip={label}
          className={cn(
            'group/item relative rounded-xl h-10 text-[13px] font-medium transition-all duration-200 overflow-hidden',
            active
              ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-[0_2px_12px_-2px_hsl(var(--primary)/0.25)]'
              : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/40 hover:translate-x-[2px]'
          )}
        >
          <Link to={item.path}>
            {/* Active left bar */}
            {active && (
              <motion.div
                layoutId="sidebar-active-bar"
                className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full"
                style={{ background: 'var(--gradient-primary)' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
            <span className={cn(
              'flex items-center justify-center w-7 h-7 rounded-lg shrink-0 transition-colors',
              active ? 'bg-primary/15 text-primary' : 'text-muted-foreground group-hover/item:text-sidebar-foreground'
            )}>
              <item.icon className="w-4 h-4" />
            </span>
            <span className="truncate">{label}</span>
            <div className="ml-auto flex items-center gap-1">
              {badgeVal > 0 && (
                <Badge
                  variant="outline"
                  className={cn(
                    'h-4 min-w-[16px] px-1 text-[9px] font-bold border-0',
                    item.badge === 'budgetsExceeded' || item.badge === 'debtsOverdue'
                      ? 'bg-destructive/15 text-destructive'
                      : 'bg-primary/15 text-primary'
                  )}
                >
                  {badgeVal > 99 ? '99+' : badgeVal}
                </Badge>
              )}
              {options.showPin !== false && !collapsed && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(item.path); }}
                  className={cn(
                    'opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5 rounded hover:bg-background/50',
                    pinnedNow && 'opacity-100 text-primary'
                  )}
                  aria-label="pin"
                >
                  <Star className={cn('w-3 h-3', pinnedNow && 'fill-current')} />
                </button>
              )}
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border/50 bg-sidebar/70 backdrop-blur-2xl"
    >
      {/* Decorative blob */}
      {!collapsed && (
        <div
          aria-hidden
          className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none"
          style={{ background: 'var(--gradient-primary)' }}
        />
      )}

      {/* Header */}
      <SidebarHeader className="p-3 relative z-10">
        <Link to="/dashboard" className="flex items-center gap-2.5 px-1">
          <motion.div
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg shrink-0 relative"
            style={{ background: 'var(--gradient-primary)' }}
            whileHover={{ scale: 1.05, rotate: 3 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <Wallet className="w-4.5 h-4.5 text-primary-foreground" style={{ width: 18, height: 18 }} />
            <div className="absolute inset-0 rounded-xl shadow-[0_0_20px_-2px_hsl(var(--primary)/0.5)]" />
          </motion.div>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex flex-col min-w-0"
            >
              <span className="font-bold font-display text-sm tracking-tight text-sidebar-foreground leading-tight">
                Budget Planner
              </span>
            </motion.div>
          )}
        </Link>
      </SidebarHeader>

      {/* Search (command palette inline) */}
      <div className="px-3 py-1 relative z-10">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onSearchOpen}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
              >
                <Search className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {locale === 'fr' ? 'Rechercher' : 'Search'} (⌘K)
            </TooltipContent>
          </Tooltip>
        ) : (
          <button
            onClick={onSearchOpen}
            className="w-full flex items-center gap-2.5 px-3 h-9 rounded-xl border border-sidebar-border/60 bg-sidebar-accent/40 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground hover:border-primary/30 hover:shadow-[0_0_12px_-4px_hsl(var(--primary)/0.4)] transition-all"
          >
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 text-left truncate">{locale === 'fr' ? 'Rechercher partout...' : 'Search everywhere...'}</span>
            <kbd className="hidden md:inline-flex h-5 items-center gap-0.5 rounded border border-sidebar-border bg-background/60 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </button>
        )}
      </div>

      <SidebarSeparator className="bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />

      {/* Navigation */}
      <SidebarContent className="px-2 relative z-10">
        {/* Home */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>{renderItem(homeItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Pinned */}
        {pinnedItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-2 flex items-center gap-1.5">
              <Pin className="w-2.5 h-2.5" />
              {t.pinned}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {pinnedItems.map(item => renderItem(item))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* ERP groups — collapsible */}
        {groups.map((group) => {
          const groupActive = group.items.some(i => isActive(i));
          const label = t[group.labelKey];

          if (collapsed) {
            return (
              <SidebarGroup key={group.id}>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map(item => renderItem(item, { showPin: false }))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          }

          return (
            <Collapsible key={group.id} defaultOpen={groupActive} className="group/coll">
              <SidebarGroup>
                <CollapsibleTrigger className="w-full">
                  <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-2 flex items-center gap-2 cursor-pointer hover:text-sidebar-foreground transition-colors group/label">
                    <group.icon className="w-3 h-3 opacity-60" />
                    <span className="flex-1 text-left">{label}</span>
                    <ChevronDown className="w-3 h-3 transition-transform group-data-[state=closed]/coll:-rotate-90" />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map(item => renderItem(item))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>

      <SidebarSeparator className="bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />

      {/* Footer */}
      <SidebarFooter className="p-3 space-y-2 relative z-10">
        {/* Theme + lang segment */}
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setMode(mode === 'dark' ? 'light' : mode === 'light' ? 'auto' : 'dark')}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
              >
                {mode === 'dark' ? <Moon className="w-3.5 h-3.5" /> :
                 mode === 'light' ? <Sun className="w-3.5 h-3.5" /> :
                 <Monitor className="w-3.5 h-3.5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {mode === 'dark' ? 'Sombre' : mode === 'light' ? 'Clair' : 'Auto'}
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex items-center gap-1">
            <div className="flex-1 flex items-center gap-0.5 p-0.5 rounded-xl bg-sidebar-accent/40 border border-sidebar-border/40 backdrop-blur-sm">
              {[
                { m: 'light' as const, icon: Sun },
                { m: 'dark' as const, icon: Moon },
                { m: 'auto' as const, icon: Monitor },
              ].map(({ m, icon: Icon }) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    'flex-1 flex items-center justify-center h-7 rounded-lg text-[10px] font-medium transition-all',
                    mode === m
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="w-3 h-3" />
                </button>
              ))}
            </div>
            <Button variant="ghost" size="icon" className="text-muted-foreground rounded-xl h-8 w-8 shrink-0 border border-sidebar-border/40" onClick={toggleLocale}>
              <Globe className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        {/* User avatar + popover */}
        <Popover open={profilePopoverOpen} onOpenChange={setProfilePopoverOpen}>
          <PopoverTrigger asChild>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="w-8 h-8 rounded-full ring-2 ring-primary/30 hover:ring-primary/50 transition-all overflow-hidden">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={profile?.avatar_url || undefined} alt={displayName} />
                      <AvatarFallback className="text-[10px] font-bold" style={{ background: 'var(--gradient-primary)', color: 'hsl(var(--primary-foreground))' }}>
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{displayName}</TooltipContent>
              </Tooltip>
            ) : (
              <button className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-sidebar-accent/50 transition-all group border border-transparent hover:border-sidebar-border/40">
                <div className="relative shrink-0">
                  <Avatar className="w-9 h-9 ring-2 ring-primary/30 group-hover:ring-primary/50 transition-all">
                    <AvatarImage src={profile?.avatar_url || undefined} alt={displayName} />
                    <AvatarFallback className="text-[10px] font-bold" style={{ background: 'var(--gradient-primary)', color: 'hsl(var(--primary-foreground))' }}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {userPlan === 'premium' && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-accent flex items-center justify-center ring-2 ring-sidebar">
                      <Sparkles className="w-2 h-2 text-accent-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-semibold text-sidebar-foreground truncate">{displayName}</p>
                  <p className="text-[10px] text-muted-foreground truncate capitalize">{userPlan || t.freePlan}</p>
                </div>
                <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0 group-hover:text-sidebar-foreground transition-colors" />
              </button>
            )}
          </PopoverTrigger>
          <PopoverContent
            side={collapsed ? 'right' : 'top'}
            align="start"
            className="w-64 p-0 rounded-2xl overflow-hidden border-border/50 shadow-lg backdrop-blur-xl"
          >
            <div className="p-4 pb-3">
              <div className="flex items-center gap-3">
                <Avatar className="w-11 h-11 ring-2 ring-primary/30">
                  <AvatarImage src={profile?.avatar_url || undefined} alt={displayName} />
                  <AvatarFallback className="text-sm font-bold" style={{ background: 'var(--gradient-primary)', color: 'hsl(var(--primary-foreground))' }}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{displayName}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{userEmail || ''}</p>
                </div>
              </div>
              <div className="mt-2.5">
                <Badge variant="outline" className={cn('text-[9px] font-bold uppercase', planColor)}>
                  <Sparkles className="w-2.5 h-2.5 mr-1" />
                  {userPlan || t.freePlan}
                </Badge>
              </div>
            </div>

            <Separator />

            <div className="p-1.5">
              <button
                onClick={() => { setProfilePopoverOpen(false); navigate('/dashboard/settings'); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-foreground hover:bg-muted/60 transition-colors"
              >
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                {locale === 'fr' ? 'Mon profil' : 'My profile'}
              </button>
              <button
                onClick={() => { setProfilePopoverOpen(false); navigate('/dashboard/payment'); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-foreground hover:bg-muted/60 transition-colors"
              >
                <Crown className="w-3.5 h-3.5 text-muted-foreground" />
                {locale === 'fr' ? 'Abonnement' : 'Subscription'}
              </button>
              <button
                onClick={() => { setProfilePopoverOpen(false); navigate('/dashboard/settings'); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-foreground hover:bg-muted/60 transition-colors"
              >
                <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                {t.settings}
              </button>
            </div>

            <Separator />

            <div className="p-1.5">
              <button
                onClick={() => { setProfilePopoverOpen(false); onLogout(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-destructive/80 hover:text-destructive hover:bg-destructive/5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                {t.logout}
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
