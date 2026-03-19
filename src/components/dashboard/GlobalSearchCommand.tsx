import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboard, ArrowUpDown, CreditCard, PieChart, Target, FileText,
  Settings, Tag, BarChart3, Users, Receipt, Crown, Search,
} from 'lucide-react';

interface SearchResult {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  action: () => void;
}

interface GlobalSearchCommandProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GlobalSearchCommand = ({ open, onOpenChange }: GlobalSearchCommandProps) => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const t = dashT[locale];
  const isFr = locale === 'fr';

  const [query, setQuery] = useState('');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load data when dialog opens
  useEffect(() => {
    if (!open || !user || loaded) return;
    const load = async () => {
      const [txRes, accRes, budRes, catRes, savRes] = await Promise.all([
        supabase.from('transactions').select('id, description, amount, type, date, categories(name, icon)')
          .eq('user_id', user.id).order('date', { ascending: false }).limit(100),
        supabase.from('payment_accounts').select('id, name, icon, real_balance').eq('user_id', user.id),
        supabase.from('budgets').select('id, name, amount, period, categories(name, icon)').eq('user_id', user.id),
        supabase.from('categories').select('id, name, icon, type').eq('user_id', user.id),
        supabase.from('savings_goals').select('id, name, icon, current_amount, target_amount').eq('user_id', user.id),
      ]);
      setTransactions(txRes.data || []);
      setAccounts(accRes.data || []);
      setBudgets(budRes.data || []);
      setCategories(catRes.data || []);
      setSavingsGoals(savRes.data || []);
      setLoaded(true);
    };
    load();
  }, [open, user, loaded]);

  // Reset when closed
  useEffect(() => {
    if (!open) { setQuery(''); setLoaded(false); }
  }, [open]);

  const go = useCallback((path: string) => {
    onOpenChange(false);
    navigate(path);
  }, [navigate, onOpenChange]);

  // Navigation pages
  const navPages: SearchResult[] = useMemo(() => [
    { id: 'nav-dashboard', label: t.dashboard, icon: <LayoutDashboard className="w-4 h-4" />, action: () => go('/dashboard') },
    { id: 'nav-transactions', label: t.transactions, icon: <ArrowUpDown className="w-4 h-4" />, action: () => go('/dashboard/transactions') },
    { id: 'nav-accounts', label: t.accounts, icon: <CreditCard className="w-4 h-4" />, action: () => go('/dashboard/accounts') },
    { id: 'nav-budgets', label: t.budgets, icon: <PieChart className="w-4 h-4" />, action: () => go('/dashboard/budgets') },
    { id: 'nav-savings', label: t.savings, icon: <Target className="w-4 h-4" />, action: () => go('/dashboard/savings') },
    { id: 'nav-categories', label: t.categories, icon: <Tag className="w-4 h-4" />, action: () => go('/dashboard/categories') },
    { id: 'nav-forecasts', label: t.forecasts, icon: <BarChart3 className="w-4 h-4" />, action: () => go('/dashboard/forecasts') },
    { id: 'nav-reports', label: t.reports, icon: <FileText className="w-4 h-4" />, action: () => go('/dashboard/reports') },
    { id: 'nav-family', label: t.family, icon: <Users className="w-4 h-4" />, action: () => go('/dashboard/family') },
    { id: 'nav-receipts', label: t.receipts, icon: <Receipt className="w-4 h-4" />, action: () => go('/dashboard/receipts') },
    { id: 'nav-payment', label: t.payment, icon: <Crown className="w-4 h-4" />, action: () => go('/dashboard/payment') },
    { id: 'nav-settings', label: t.settings, icon: <Settings className="w-4 h-4" />, action: () => go('/dashboard/settings') },
  ], [t, go]);

  const q = query.toLowerCase().trim();

  const filteredNav = q ? navPages.filter(p => p.label.toLowerCase().includes(q)) : navPages.slice(0, 6);

  const filteredTransactions = useMemo(() => {
    if (!q) return transactions.slice(0, 5);
    return transactions.filter(tx =>
      tx.description?.toLowerCase().includes(q) ||
      (tx.categories as any)?.name?.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [q, transactions]);

  const filteredAccounts = useMemo(() => {
    if (!q) return accounts.slice(0, 4);
    return accounts.filter(a => a.name.toLowerCase().includes(q)).slice(0, 5);
  }, [q, accounts]);

  const filteredBudgets = useMemo(() => {
    if (!q) return budgets.slice(0, 4);
    return budgets.filter(b =>
      b.name.toLowerCase().includes(q) ||
      (b.categories as any)?.name?.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [q, budgets]);

  const filteredCategories = useMemo(() => {
    if (!q) return [];
    return categories.filter(c => c.name.toLowerCase().includes(q)).slice(0, 5);
  }, [q, categories]);

  const filteredSavings = useMemo(() => {
    if (!q) return savingsGoals.slice(0, 4);
    return savingsGoals.filter(g => g.name.toLowerCase().includes(q)).slice(0, 5);
  }, [q, savingsGoals]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder={isFr ? 'Rechercher partout... (transactions, comptes, budgets...)' : 'Search everywhere... (transactions, accounts, budgets...)'}
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>{isFr ? 'Aucun résultat trouvé.' : 'No results found.'}</CommandEmpty>

        {/* Navigation */}
        {filteredNav.length > 0 && (
          <CommandGroup heading={isFr ? 'Navigation' : 'Navigation'}>
            {filteredNav.map(item => (
              <CommandItem key={item.id} onSelect={item.action} className="gap-2.5 cursor-pointer">
                {item.icon}
                <span>{item.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Transactions */}
        {filteredTransactions.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t.transactions}>
              {filteredTransactions.map(tx => (
                <CommandItem
                  key={tx.id}
                  onSelect={() => go(`/dashboard/transactions?q=${encodeURIComponent(tx.description)}`)}
                  className="gap-2.5 cursor-pointer"
                >
                  <span className="text-base">{(tx.categories as any)?.icon || '📁'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{tx.description}</p>
                    <p className="text-[10px] text-muted-foreground">{tx.date} · {(tx.categories as any)?.name || '-'}</p>
                  </div>
                  <span className={`text-xs font-bold ${tx.type === 'income' ? 'text-secondary' : 'text-destructive'}`}>
                    {tx.type === 'income' ? '+' : '-'}{Number(tx.amount).toLocaleString()}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Accounts */}
        {filteredAccounts.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t.accounts}>
              {filteredAccounts.map(a => (
                <CommandItem
                  key={a.id}
                  onSelect={() => go('/dashboard/accounts')}
                  className="gap-2.5 cursor-pointer"
                >
                  <span className="text-base">{a.icon}</span>
                  <span className="flex-1">{a.name}</span>
                  <span className="text-xs font-bold">{Number(a.real_balance).toLocaleString()}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Budgets */}
        {filteredBudgets.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t.budgets}>
              {filteredBudgets.map(b => (
                <CommandItem
                  key={b.id}
                  onSelect={() => go('/dashboard/budgets')}
                  className="gap-2.5 cursor-pointer"
                >
                  <span className="text-base">{(b.categories as any)?.icon || '📁'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{b.name}</p>
                    <p className="text-[10px] text-muted-foreground">{(b.categories as any)?.name || '-'} · {b.period}</p>
                  </div>
                  <span className="text-xs font-bold">{Number(b.amount).toLocaleString()}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Categories */}
        {filteredCategories.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t.categories}>
              {filteredCategories.map(c => (
                <CommandItem
                  key={c.id}
                  onSelect={() => go(`/dashboard/transactions?category=${c.name}`)}
                  className="gap-2.5 cursor-pointer"
                >
                  <span className="text-base">{c.icon}</span>
                  <span>{c.name}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{c.type}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Savings */}
        {filteredSavings.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t.savings}>
              {filteredSavings.map(g => {
                const pct = Number(g.target_amount) > 0 ? Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100) : 0;
                return (
                  <CommandItem
                    key={g.id}
                    onSelect={() => go('/dashboard/savings')}
                    className="gap-2.5 cursor-pointer"
                  >
                    <span className="text-base">{g.icon}</span>
                    <span className="flex-1">{g.name}</span>
                    <span className="text-xs font-bold">{pct}%</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
};

export default GlobalSearchCommand;
