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
  Sparkles, User, ChevronUp, Landmark, RefreshCw, Gem
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AppSidebarProps {
  profile: { display_name: string | null; avatar_url: string | null } | null;
  userPlan: string | null;
  userEmail: string | null;
  onLogout: () => void;
  onSearchOpen: () => void;
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

  const displayName = profile?.display_name || 'User';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

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
        { key: 'categories', icon: Tag, path: '/dashboard/categories' },
        { key: 'debts', icon: Landmark, path: '/dashboard/debts' },
        { key: 'recurring', icon: RefreshCw, path: '/dashboard/recurring' },
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
      label: locale === 'fr' ? 'Autres' : 'Other',
      items: [
        { key: 'receipts', icon: Receipt, path: '/dashboard/receipts' },
        { key: 'payment', icon: Crown, path: '/dashboard/payment' },
        { key: 'settings', icon: Settings, path: '/dashboard/settings' },
        ...(isAdmin ? [{ key: 'adminPricing', icon: Shield, path: '/dashboard/admin/pricing' }] : []),
      ],
    },
  ];

  const isActive = (item: { key: string; path: string }) =>
    item.key === 'dashboard' ? location.pathname === '/dashboard' : location.pathname === item.path;

  const planColor = userPlan === 'premium' ? 'bg-accent/15 text-accent border-accent/20' :
    userPlan === 'pro' ? 'bg-primary/15 text-primary border-primary/20' :
    'bg-muted/60 text-muted-foreground border-border';

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      {/* Header */}
      <SidebarHeader className="p-3">
        <Link to="/dashboard" className="flex items-center gap-2.5 px-1">
          <motion.div
            className="w-8 h-8 rounded-xl flex items-center justify-center shadow-md shrink-0"
            style={{ background: 'var(--gradient-primary)' }}
            whileHover={{ scale: 1.05, rotate: 3 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <Wallet className="w-4 h-4 text-primary-foreground" />
          </motion.div>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="font-bold font-display text-sm tracking-tight text-sidebar-foreground"
            >
              Budget Planner
            </motion.span>
          )}
        </Link>
      </SidebarHeader>

      <SidebarSeparator />

      {/* Search button */}
      <div className="px-3 py-2">
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
            className="w-full flex items-center gap-2.5 px-3 h-9 rounded-xl border border-sidebar-border bg-sidebar-accent/40 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-all"
          >
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 text-left truncate">{locale === 'fr' ? 'Rechercher...' : 'Search...'}</span>
            <kbd className="hidden md:inline-flex h-5 items-center gap-0.5 rounded border border-sidebar-border bg-background/50 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              ⌘K
            </kbd>
          </button>
        )}
      </div>

      {/* Navigation */}
      <SidebarContent className="px-2">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 px-2">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isActive(item);
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={t[item.key as keyof typeof t] as string}
                        className={cn(
                          'rounded-xl h-9 text-[13px] font-medium transition-all duration-200',
                          active
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50'
                        )}
                      >
                        <Link to={item.path}>
                          <item.icon className={cn(
                            'w-4 h-4 shrink-0 transition-colors',
                            active ? 'text-primary' : ''
                          )} />
                          <span>{t[item.key as keyof typeof t] as string}</span>
                          {active && (
                            <motion.div
                              layoutId="sidebar-active-dot"
                              className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ background: 'var(--gradient-primary)' }}
                              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            />
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarSeparator />

      {/* Footer */}
      <SidebarFooter className="p-3 space-y-2">
        {/* Theme toggle */}
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
            <div className="flex-1 flex items-center gap-0.5 p-0.5 rounded-xl bg-sidebar-accent/40">
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
            <Button variant="ghost" size="icon" className="text-muted-foreground rounded-xl h-8 w-8 shrink-0" onClick={toggleLocale}>
              <Globe className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        {/* User avatar + mini-profile popover */}
        <Popover open={profilePopoverOpen} onOpenChange={setProfilePopoverOpen}>
          <PopoverTrigger asChild>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="w-8 h-8 rounded-full ring-2 ring-primary/20 hover:ring-primary/40 transition-all overflow-hidden">
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
              <button className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-sidebar-accent/50 transition-all group">
                <Avatar className="w-8 h-8 ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all shrink-0">
                  <AvatarImage src={profile?.avatar_url || undefined} alt={displayName} />
                  <AvatarFallback className="text-[10px] font-bold" style={{ background: 'var(--gradient-primary)', color: 'hsl(var(--primary-foreground))' }}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-semibold text-sidebar-foreground truncate">{displayName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{userEmail || ''}</p>
                </div>
                <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0 group-hover:text-sidebar-foreground transition-colors" />
              </button>
            )}
          </PopoverTrigger>
          <PopoverContent
            side={collapsed ? 'right' : 'top'}
            align="start"
            className="w-64 p-0 rounded-2xl overflow-hidden border-border/50 shadow-lg"
          >
            {/* Profile header */}
            <div className="p-4 pb-3">
              <div className="flex items-center gap-3">
                <Avatar className="w-11 h-11 ring-2 ring-primary/20">
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

            {/* Quick actions */}
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

            {/* Logout */}
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
