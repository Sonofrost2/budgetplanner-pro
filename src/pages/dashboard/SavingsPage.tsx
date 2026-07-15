import { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { invokeAuthedEdgeFunction } from '@/lib/aiEdge';
import { useInvalidate, useSavingsPageData, useBudgets } from '@/hooks/useDashboardData';
import type { Account, SavingsGoal } from '@/hooks/useDashboardData';
import { savingsGoalSchema, validateForm } from '@/lib/validationSchemas';
import { currencySymbol, exampleAmount, amountLabel } from '@/lib/currency';

interface SavingsContribution {
  id: string;
  amount: number;
  date: string;
  type: 'deposit' | 'withdrawal';
  account_name?: string;
  account_icon?: string;
  description?: string;
}
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ResponsiveFormDialog } from '@/components/ui/responsive-form-dialog';
import { InputField } from '@/components/ui/input-field';
import { FormSection } from '@/components/ui/form-section';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, PiggyBank, RefreshCw, Sparkles, Lock, Unlock, TrendingUp, Lightbulb, BarChart3, Download, Calculator, Target, CalendarDays, Building2, Percent, CheckCircle2, Search, X, Link2, Flag, Tag, StickyNote } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Textarea } from '@/components/ui/textarea';
import { AddContributionDialog, WithdrawDialog, SimulationDialog } from '@/components/dashboard/savings/SavingsDialogs';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SavingsProjectionsTab from '@/components/dashboard/tabs/SavingsProjectionsTab';
import SavingsEvolutionTab from '@/components/dashboard/tabs/SavingsEvolutionTab';
import { FilterToolbar } from '@/components/dashboard/FilterToolbar';
import { toast } from 'sonner';
import { showApiError } from '@/lib/apiError';
import { coachToast } from '@/lib/coachToast';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDeleteDialog from '@/components/dashboard/ConfirmDeleteDialog';
import { AccountCombobox } from '@/components/dashboard/AccountCombobox';
import { LinkPicker } from '@/components/dashboard/LinkPicker';
import { recalculateAccountBalance } from '@/hooks/useAccountBalance';
import { SavingsGoalCard } from '@/components/dashboard/savings/SavingsGoalCard';
import { PartialWithdrawDialog } from '@/components/dashboard/savings/PartialWithdrawDialog';
import { SavingsSummaryTable } from '@/components/dashboard/savings/SavingsSummaryTable';
import { SavingsControlTable } from '@/components/dashboard/savings/SavingsControlTable';
import { SavingsGlobalStats } from '@/components/dashboard/savings/SavingsGlobalStats';
import { SavingsHeroHeader } from '@/components/dashboard/savings/SavingsHeroHeader';
import { SavingsCoachInsights } from '@/components/dashboard/savings/SavingsCoachInsights';
import { GoalReachedDialog } from '@/components/dashboard/savings/GoalReachedDialog';
import { VirtualizedGoalsGrid } from '@/components/dashboard/savings/VirtualizedGoalsGrid';

interface ScenarioData {
  monthly_projections: { month: number; capital: number; interest_earned: number; total: number }[];
  interest_income_1y: number;
  interest_income_3y: number;
  interest_income_5y: number;
  estimated_goal_date?: string | null;
}

interface SimulationResult {
  continue: ScenarioData;
  stop_now: ScenarioData;
  interest_lost: number;
  recommendations: string[];
  summary: string;
}

const SavingsPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency, currency } = useProfile();
  const t = dashT[locale];
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('q') || '';
  const { data: savingsData, isLoading: loading, refetch: refetchSavings } = useSavingsPageData();
  const { data: budgetsAll = [] } = useBudgets();
  const goals = savingsData?.goals ?? [];
  const accounts = savingsData?.accounts ?? [];
  const contributions = savingsData?.contributions ?? {};
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [sortField, setSortField] = useState<'name' | 'current_amount' | 'target_amount'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editGoalId, setEditGoalId] = useState<string | null>(null);
  const [addAmountDialog, setAddAmountDialog] = useState<string | null>(null);
  const [withdrawDialog, setWithdrawDialog] = useState<string | null>(null);
  const [partialWithdrawId, setPartialWithdrawId] = useState<string | null>(null);
  const [addAmount, setAddAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [targetAccountId, setTargetAccountId] = useState('');
  const [form, setForm] = useState({
    name: '', target_amount: '', icon: '🎯', deadline: '', account_id: '',
    monthly_contribution: '', start_date: '', contribution_day: '',
    is_locked: false, interest_rate: '', interest_frequency: 'yearly', bank_name: '',
    linked_budget_id: '',
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [simulationDialog, setSimulationDialog] = useState<string | null>(null);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [customBankMode, setCustomBankMode] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState('manage');
  const [savingsView, setSavingsView] = useState<'cards' | 'table'>(() => {
    try { return (localStorage.getItem('savings-view') as 'cards' | 'table') || 'cards'; } catch { return 'cards'; }
  });
  useEffect(() => {
    try { localStorage.setItem('savings-view', savingsView); } catch {}
  }, [savingsView]);
  const [showCompleted, setShowCompleted] = useState<boolean>(() => {
    try { return localStorage.getItem('savings-show-completed') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem('savings-show-completed', showCompleted ? '1' : '0'); } catch {}
  }, [showCompleted]);
  const notifiedRef = useRef<Set<string>>(new Set());
  const milestoneRef = useRef<Map<string, Set<number>>>(new Map());
  const [reachedDialogGoalId, setReachedDialogGoalId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Quick-search keyboard shortcuts: "/" focuses the search; Cmd/Ctrl+F too.
  // Esc clears + blurs when focused. Only active on the Manage tab so it does
  // not steal focus on Evolution/Projections charts.
  useEffect(() => {
    if (activeMainTab !== 'manage') return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const editing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      // "/" — global focus shortcut (only when not already typing)
      if (e.key === '/' && !editing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      // Cmd/Ctrl+F — intercept browser find for an in-app search
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }
      // Esc — clear + blur when focused on our search
      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        if (searchQuery) {
          e.preventDefault();
          setSearchQuery('');
        } else {
          searchInputRef.current?.blur();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeMainTab, searchQuery]);

  const fmt = (n: number) => fmtCurrency(n, locale);
  const { invalidate } = useInvalidate();

  // Invalidate react-query caches that depend on transactions/accounts
  const invalidateCrossModule = () => {
    invalidate(
      'accounts', 'account-theoretical-balances', 'account-transactions',
      'transactions', 'paginated-transactions', 'chart-data', 'all-transactions',
      'savings-goals', 'savings-page-data',
      'budget-spending', 'budget-annual-spending',
      'reports-data', 'forecast-raw-tx',
    );
  };

  const filteredGoals = useMemo(() => {
    let result = [...goals];
    // Hide completed / archived / paused goals unless the user opts in via the
    // 'Atteints / Archivés' toggle. Source of truth lives in `savingsLogic`.
    if (!showCompleted) {
      result = result.filter(g =>
        !g.deleted_at &&
        !(g as any).paused_at &&
        ((g as any).status ?? 'active') === 'active'
      );
    }
    if (searchQuery) {
      const terms = searchQuery.split(';').map(s => s.trim().toLowerCase()).filter(Boolean);
      result = result.filter(g => terms.some(q => g.name.toLowerCase().includes(q) || (g as any).bank_name?.toLowerCase().includes(q)));
    }
    // Performant sort: pre-extract sort key once per item (Schwartzian transform)
    // and use Intl.Collator (much faster than per-call localeCompare).
    const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
    const dir = sortOrder === 'desc' ? -1 : 1;
    if (sortField === 'name') {
      const keyed = result.map(g => ({ g, k: g.name }));
      keyed.sort((a, b) => dir * collator.compare(a.k, b.k));
      result = keyed.map(x => x.g);
    } else {
      // Robust numeric sort: handles null/undefined, formatted strings, and negatives
      const parseNumeric = (val: unknown): number => {
        if (val == null) return 0;
        if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
        if (typeof val === 'string') {
          // Remove common formatting: spaces, commas, currency symbols
          const cleaned = val.replace(/[\s,\u202f\u00a0]/g, '').replace(/[^\d.\-]/g, '');
          const n = parseFloat(cleaned);
          return Number.isFinite(n) ? n : 0;
        }
        return 0;
      };
      const field = sortField as 'current_amount' | 'target_amount';
      const keyed = result.map(g => ({ g, k: parseNumeric(g[field]) }));
      keyed.sort((a, b) => dir * (a.k - b.k));
      result = keyed.map(x => x.g);
    }
    return result;
  }, [goals, searchQuery, sortField, sortOrder, showCompleted, locale]);

  const refreshData = async () => { await refetchSavings(); };

  // Export the *currently filtered & sorted* goals to an .xlsx workbook.
  // Honors: search, showCompleted toggle, sortField + sortOrder.
  const handleExportExcel = async () => {
    if (filteredGoals.length === 0) {
      toast.error(locale === 'fr' ? 'Aucun objectif à exporter' : 'No goal to export');
      return;
    }
    try {
      const XLSX = await import('xlsx');
      const isFr = locale === 'fr';
      const rows = filteredGoals.map((g) => {
        const target = Number(g.target_amount) || 0;
        const current = Number(g.current_amount) || 0;
        const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
        const status = (g as any).status === 'completed'
          ? (isFr ? 'Atteint' : 'Completed')
          : (g as any).paused_at
            ? (isFr ? 'En pause' : 'Paused')
            : (isFr ? 'Actif' : 'Active');
        return {
          [isFr ? 'Icône' : 'Icon']: g.icon || '',
          [isFr ? 'Nom' : 'Name']: g.name,
          [isFr ? 'Banque' : 'Bank']: (g as any).bank_name || '',
          [isFr ? 'Statut' : 'Status']: status,
          [isFr ? 'Épargné' : 'Saved']: current,
          [isFr ? 'Objectif' : 'Target']: target,
          [isFr ? 'Restant' : 'Remaining']: Math.max(0, target - current),
          [isFr ? 'Progression %' : 'Progress %']: Number(pct.toFixed(1)),
          [isFr ? 'Cotisation mensuelle' : 'Monthly contribution']: Number(g.monthly_contribution) || 0,
          [isFr ? "Taux d'intérêt %" : 'Interest rate %']: Number((g as any).interest_rate) || 0,
          [isFr ? 'Échéance' : 'Deadline']: g.deadline || '',
          [isFr ? 'Verrouillé' : 'Locked']: (g as any).is_locked ? (isFr ? 'Oui' : 'Yes') : (isFr ? 'Non' : 'No'),
          [isFr ? 'Devise' : 'Currency']: currency,
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      // Auto-size columns based on header + sample values
      const headers = Object.keys(rows[0]);
      ws['!cols'] = headers.map((h) => {
        const maxLen = Math.max(
          h.length,
          ...rows.slice(0, 50).map((r) => String((r as any)[h] ?? '').length)
        );
        return { wch: Math.min(40, Math.max(10, maxLen + 2)) };
      });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, isFr ? 'Épargne' : 'Savings');
      const stamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `${isFr ? 'epargne' : 'savings'}-${stamp}.xlsx`);
      coachToast.saved(isFr
        ? `${rows.length} objectif(s) exporté(s)`
        : `${rows.length} goal(s) exported`);
    } catch (err: any) {
      coachToast.fail(err?.message || 'Export error');
    }
  };

  // Force recalculate all current_amounts from transactions
  const [recalculating, setRecalculating] = useState(false);
  const handleRecalculate = async () => {
    if (!user) return;
    setRecalculating(true);
    try {
      // Fetch goals with linked accounts
      const { data: goalsData } = await supabase.from('savings_goals')
        .select('id, name, account_id, current_amount, payment_accounts(opening_balance)')
        .eq('user_id', user.id);
      if (!goalsData) { setRecalculating(false); return; }

      const withAccount = goalsData.filter(g => g.account_id);
      const accountIds = withAccount.map(g => g.account_id!);
      if (accountIds.length === 0) {
        coachToast.remind(locale === 'fr' ? 'Aucun objectif avec compte lié' : 'No goals with linked accounts');
        setRecalculating(false);
        return;
      }

      const { data: txs } = await supabase.from('transactions')
        .select('account_id, type, amount')
        .eq('user_id', user.id)
        .in('account_id', accountIds);

      let updated = 0;
      for (const goal of withAccount) {
        const opening = Number((goal.payment_accounts as any)?.opening_balance) || 0;
        const goalTxs = (txs || []).filter(t => t.account_id === goal.account_id);
        const income = goalTxs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
        const expense = goalTxs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
        const computed = opening + income - expense;
        if (Math.abs(computed - Number(goal.current_amount)) > 0.5) {
          await supabase.from('savings_goals').update({ current_amount: computed }).eq('id', goal.id);
          updated++;
        }
      }

      await refreshData();
      invalidateCrossModule();
      coachToast.saved(locale === 'fr'
        ? `${updated} objectif(s) recalculé(s) depuis les transactions`
        : `${updated} goal(s) recalculated from transactions`);
    } catch (err: any) {
      coachToast.fail(err.message || 'Erreur');
    } finally {
      setRecalculating(false);
    }
  };


  const handleSyncSavings = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      // Find transactions that look like savings contributions (CAG, épargne patterns)
      const { data: txs } = await supabase.from('transactions')
        .select('id, amount, date, notes, type, account_id, description, payment_accounts:account_id(name, icon)')
        .eq('user_id', user.id)
        .or('description.ilike.%épargne%,description.ilike.%cag%,description.ilike.%savings%,notes.ilike.%🎯%')
        .order('date', { ascending: true })
        .limit(1000);

      if (!txs || txs.length === 0) {
        coachToast.remind(locale === 'fr' ? 'Aucune transaction d\'épargne trouvée' : 'No savings transactions found');
        setSyncing(false);
        return;
      }

      // Group by savings goal name (from notes or description patterns)
      const goalMap: Record<string, { total: number; txCount: number; accountId: string | null }> = {};
      for (const tx of txs) {
        let goalName = '';
        if (tx.notes?.startsWith('🎯 ')) {
          goalName = tx.notes.replace('🎯 ', '');
        } else {
          // Try to extract from description
          const desc = tx.description?.toLowerCase() || '';
          if (desc.includes('cag')) goalName = 'CAG';
          else if (desc.includes('épargne') || desc.includes('savings')) {
            goalName = tx.description || 'Épargne';
          }
        }
        if (!goalName) continue;

        if (!goalMap[goalName]) {
          goalMap[goalName] = { total: 0, txCount: 0, accountId: tx.account_id };
        }
        // For income type on savings account = deposit
        if (tx.type === 'income') {
          goalMap[goalName].total += tx.amount;
        } else if (tx.type === 'expense') {
          goalMap[goalName].total -= tx.amount;
        }
        goalMap[goalName].txCount++;
      }

      // Update or create savings goals
      let updated = 0;
      for (const [name, info] of Object.entries(goalMap)) {
        if (info.total <= 0) continue;

        const existing = goals.find(g => g.name === name);
        if (existing) {
          await supabase.from('savings_goals').update({
            current_amount: Math.max(0, info.total),
          }).eq('id', existing.id);
          updated++;
        }
      }

      await refreshData();
      coachToast.saved(locale === 'fr' ? `${updated} objectif(s) synchronisé(s)` : `${updated} goal(s) synced`);
    } catch (err: any) {
      coachToast.fail(err.message || 'Erreur');
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateOrEdit = async () => {
    if (!user) return;
    const result = validateForm(savingsGoalSchema(locale), form);
    if (result.success === false) {
      // Show first error as toast since savings form doesn't have inline errors yet
      const firstErr = Object.values(result.errors)[0];
      if (firstErr) toast.error(firstErr);
      return;
    }
    setSaving(true);
    try {
      let accountId = form.account_id || null;

      // Auto-create savings account if no account selected (only on create)
      if (!editGoalId && !accountId) {
        const accountName = `${t.savings} - ${form.name.trim()}`;
        const { data: newAccount, error: accErr } = await supabase
          .from('payment_accounts')
          .insert({
            user_id: user.id,
            name: accountName,
            type: 'savings',
            icon: form.icon || '🎯',
            opening_balance: 0,
            real_balance: 0,
          })
          .select('id')
          .single();
        if (accErr) { toast.error(accErr.message); setSaving(false); return; }
        accountId = newAccount.id;
        toast.info(t.autoAccountCreated);
      }

      const payload = {
        name: form.name.trim(),
        target_amount: Number(form.target_amount),
        icon: form.icon || '🎯',
        deadline: form.deadline || null,
        account_id: accountId,
        monthly_contribution: form.monthly_contribution ? Number(form.monthly_contribution) : 0,
        start_date: form.start_date || null,
        contribution_day: form.contribution_day ? Number(form.contribution_day) : null,
        is_locked: form.is_locked,
        interest_rate: form.interest_rate ? Number(form.interest_rate) : 0,
        interest_frequency: form.interest_frequency || 'yearly',
        bank_name: form.bank_name?.trim() || null,
        linked_budget_id: form.linked_budget_id || null,
      };

      if (editGoalId) {
        const { error } = await supabase.from('savings_goals').update(payload).eq('id', editGoalId);
        if (error) { showApiError(error, locale); setSaving(false); return; }
      } else {
        const { error } = await supabase.from('savings_goals').insert({ user_id: user.id, ...payload });
        if (error) { showApiError(error, locale); setSaving(false); return; }
      }
      setDialogOpen(false);
      setEditGoalId(null);
      // If reinvesting, archive the old goal now that new one is saved
      if (reinvestSourceGoalId) {
        await supabase.from('savings_goals').update({ status: 'completed' } as any).eq('id', reinvestSourceGoalId);
        setReinvestSourceGoalId(null);
        toast.success(locale === 'fr' ? 'Ancien objectif archivé et nouveau créé' : 'Old goal archived and new one created');
      } else {
        toast.success(t.saved);
      }
      refreshData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleAddAmount = async () => {
    if (!addAmountDialog || Number(addAmount) <= 0 || !user) return;
    const goal = goals.find(g => g.id === addAmountDialog);
    if (!goal) return;

    setSaving(true);
    try {
      const amountToAdd = Number(addAmount);
      const today = new Date().toISOString().split('T')[0];
      // Si l'objectif est lié à un budget, on récupère sa catégorie pour l'appliquer
      // à la transaction "expense" → consomme automatiquement le budget lié.
      const linkedBudget = budgetsAll.find(b => (b as any).linked_savings_goal_id === goal.id);
      const linkedCategoryId = linkedBudget?.category_id || null;
      const desc = linkedBudget
        ? `${t.savings}: ${goal.name} · ${linkedBudget.name}`
        : `${t.savings}: ${goal.name}`;

      // Use atomic transfer when both source and savings accounts exist
      if (sourceAccountId && goal.account_id && sourceAccountId !== goal.account_id) {
        const { error } = await supabase.rpc('perform_transfer', {
          p_user_id: user.id,
          p_from_account_id: sourceAccountId,
          p_to_account_id: goal.account_id,
          p_amount: amountToAdd,
          p_description: desc,
          p_expense_category_id: linkedCategoryId,
        } as any);
        if (error) throw error;
      } else {
        // Fallback: create individual transactions
        if (sourceAccountId) {
          await supabase.from('transactions').insert({
            user_id: user.id, type: 'expense', amount: amountToAdd,
            description: desc, account_id: sourceAccountId, date: today,
            category_id: linkedCategoryId,
          });
        }
        if (goal.account_id) {
          await supabase.from('transactions').insert({
            user_id: user.id, type: 'income', amount: amountToAdd,
            description: desc, account_id: goal.account_id, date: today,
          });
        }
      }

      // current_amount will be recalculated from transactions in fetchData
      // Only update manually for goals without linked account
      if (!goal.account_id) {
        await supabase.from('savings_goals').update({
          current_amount: Number(goal.current_amount) + amountToAdd,
        }).eq('id', addAmountDialog);
      }

      setAddAmountDialog(null);
      setAddAmount('');
      setSourceAccountId('');
      refreshData();
      invalidateCrossModule();
      coachToast.money(`${t.savingsContribAdded} ${goal.name}`);
    } catch (err: any) {
      coachToast.fail(err.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawDialog || Number(withdrawAmount) <= 0 || !user) return;
    const goal = goals.find(g => g.id === withdrawDialog);
    if (!goal) return;

    if ((goal as any).is_locked) {
      toast.error(t.savingsLockedWarning);
      return;
    }

    const amount = Number(withdrawAmount);
    if (amount > Number(goal.current_amount)) {
      toast.error(locale === 'fr' ? 'Montant supérieur à l\'épargne disponible' : 'Amount exceeds available savings');
      return;
    }

    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const desc = `${t.savings}: ${goal.name} ↩`;

      // Use atomic transfer when both savings and target accounts exist
      if (goal.account_id && targetAccountId && goal.account_id !== targetAccountId) {
        const { error } = await supabase.rpc('perform_transfer', {
          p_user_id: user.id,
          p_from_account_id: goal.account_id,
          p_to_account_id: targetAccountId,
          p_amount: amount,
          p_description: desc,
        });
        if (error) throw error;
      } else {
        // Fallback: create individual transactions
        if (goal.account_id) {
          await supabase.from('transactions').insert({
            user_id: user.id, type: 'expense', amount,
            description: desc, account_id: goal.account_id, date: today,
          });
        }
        if (targetAccountId) {
          await supabase.from('transactions').insert({
            user_id: user.id, type: 'income', amount,
            description: desc, account_id: targetAccountId, date: today,
          });
        }
      }

      // current_amount will be recalculated from transactions in fetchData
      if (!goal.account_id) {
        await supabase.from('savings_goals').update({
          current_amount: Math.max(0, Number(goal.current_amount) - amount),
        }).eq('id', withdrawDialog);
      }

      setWithdrawDialog(null);
      setWithdrawAmount('');
      setTargetAccountId('');
      refreshData();
      invalidateCrossModule();
      coachToast.saved(t.savingsWithdrawDone);
    } catch (err: any) {
      coachToast.fail(err.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('savings_goals').delete().eq('id', deleteId);
    setDeleteId(null);
    refreshData();
  };

  // Archive / Reactivate goal
  const handleArchive = async (goalId: string) => {
    const { error } = await supabase.from('savings_goals').update({ status: 'completed' } as any).eq('id', goalId);
    if (error) { coachToast.fail(error.message); return; }
    coachToast.win(t.goalArchived);
    refreshData();
  };

  const handleReactivate = async (goalId: string) => {
    const { error } = await supabase.from('savings_goals').update({ status: 'active' } as any).eq('id', goalId);
    if (error) { coachToast.fail(error.message); return; }
    coachToast.saved(t.goalReactivated);
    refreshData();
  };

  // Detect milestones (25/50/75%) — coach toast on threshold crossings
  useEffect(() => {
    if (!goals || goals.length === 0) return;
    for (const g of goals) {
      const target = Number(g.target_amount);
      if (target <= 0) continue;
      const pct = Math.floor((Number(g.current_amount) / target) * 100);
      const status = (g as any).status;
      if (status === 'completed' || status === 'archived') continue;
      if (!milestoneRef.current.has(g.id)) milestoneRef.current.set(g.id, new Set());
      const fired = milestoneRef.current.get(g.id)!;
      const thresholds = [25, 50, 75];
      for (const th of thresholds) {
        if (pct >= th && !fired.has(th)) {
          fired.add(th);
          // Skip the very first render (no baseline) — only fire on later updates
          if (fired.size > 1 || pct >= th + 5) {
            coachToast.win(
              locale === 'fr'
                ? `${g.icon} ${g.name} : ${th}% atteint — continuez !`
                : `${g.icon} ${g.name}: ${th}% reached — keep going!`
            );
          }
        }
      }
    }
  }, [goals, locale]);

  // Detect newly-reached goals → open the 4-option GoalReachedDialog
  // (Réinvestir / Transférer / Convertir en actif / Archiver). Each goal is
  // prompted at most once per session via `notifiedRef`.
  useEffect(() => {
    if (!goals || goals.length === 0) return;
    if (reachedDialogGoalId) return; // already showing for another goal
    for (const g of goals) {
      const status = (g as any).status;
      const reached = Number(g.current_amount) >= Number(g.target_amount) && Number(g.target_amount) > 0;
      if (!reached || status === 'completed' || status === 'archived') continue;
      if (notifiedRef.current.has(g.id)) continue;
      notifiedRef.current.add(g.id);
      setReachedDialogGoalId(g.id);
      break; // one dialog at a time
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals, locale]);

  const [reinvestDialog, setReinvestDialog] = useState<string | null>(null);
  const [reinvestSourceGoalId, setReinvestSourceGoalId] = useState<string | null>(null);
  const handleReinvest = (goalId: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    // Store old goal ID — archive ONLY after new form is saved
    setReinvestSourceGoalId(goalId);
    setEditGoalId(null);
    setForm({
      name: '', target_amount: '', icon: '🎯', deadline: '',
      account_id: goal.account_id || '',
      monthly_contribution: goal.monthly_contribution ? String(goal.monthly_contribution) : '',
      start_date: new Date().toISOString().split('T')[0],
      contribution_day: (goal as any).contribution_day ? String((goal as any).contribution_day) : '',
      is_locked: (goal as any).is_locked || false,
      interest_rate: (goal as any).interest_rate ? String((goal as any).interest_rate) : '',
      interest_frequency: (goal as any).interest_frequency || 'yearly',
      bank_name: (goal as any).bank_name || '',
      linked_budget_id: '',
    });
    setCustomBankMode(false);
    setDialogOpen(true);
    // DO NOT archive here — archive only after user validates the new form
  };

  // Capitalize interest — with temporal guardrail
  const [capitalizingGoalId, setCapitalizingGoalId] = useState<string | null>(null);
  const handleCapitalizeInterest = async (goalId: string) => {
    if (!user) return;
    const goal = goals.find(g => g.id === goalId);
    if (!goal || !goal.account_id) return;
    const rate = Number((goal as any).interest_rate) || 0;
    if (rate <= 0) return;

    // Check last_capitalized_at to prevent duplicate capitalizations
    const freq = (goal as any).interest_frequency || 'yearly';
    const lastCap = (goal as any).last_capitalized_at ? new Date((goal as any).last_capitalized_at) : null;
    if (lastCap) {
      const now = new Date();
      const diffMs = now.getTime() - lastCap.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      const minDays: Record<string, number> = { monthly: 25, quarterly: 80, semi_annual: 160, yearly: 350 };
      const required = minDays[freq] || 350;
      if (diffDays < required) {
        const nextDate = new Date(lastCap.getTime() + required * 86400000);
        toast.error(locale === 'fr'
          ? `Prochaine capitalisation possible le ${nextDate.toLocaleDateString('fr-FR')}`
          : `Next capitalization available on ${nextDate.toLocaleDateString('en-US')}`);
        return;
      }
    }

    setCapitalizingGoalId(goalId);
    try {
      const currentAmount = Number(goal.current_amount);
      
      let periodRate: number;
      let periodLabel: string;
      if (freq === 'monthly') { periodRate = rate / 100 / 12; periodLabel = locale === 'fr' ? 'mensuel' : 'monthly'; }
      else if (freq === 'quarterly') { periodRate = rate / 100 / 4; periodLabel = locale === 'fr' ? 'trimestriel' : 'quarterly'; }
      else if (freq === 'semi_annual') { periodRate = rate / 100 / 2; periodLabel = locale === 'fr' ? 'semestriel' : 'semi-annual'; }
      else { periodRate = rate / 100; periodLabel = locale === 'fr' ? 'annuel' : 'yearly'; }

      const interestAmount = Math.round(currentAmount * periodRate);
      if (interestAmount <= 0) {
        toast.info(t.noInterestDue);
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const desc = `${locale === 'fr' ? 'Intérêts' : 'Interest'} ${periodLabel} - ${goal.name} (${rate}%)`;

      const { error } = await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'income',
        amount: interestAmount,
        description: desc,
        account_id: goal.account_id,
        date: today,
        notes: `💰 ${goal.icon} ${goal.name}`,
      });
      if (error) throw error;

      // Update last_capitalized_at
      await supabase.from('savings_goals').update({ last_capitalized_at: new Date().toISOString() } as any).eq('id', goalId);

      coachToast.money(`${t.interestCapitalized}: +${fmt(interestAmount)}`);
      refreshData();
      invalidateCrossModule();
    } catch (err: any) {
      coachToast.fail(err.message || 'Erreur');
    } finally {
      setCapitalizingGoalId(null);
    }
  };

  // AI Simulation
  const handleSimulate = async (goalId: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    setSimulationDialog(goalId);
    setSimulation(null);
    setSimulating(true);
    try {
      const data = await invokeAuthedEdgeFunction<any>('ai-savings-simulate', {
        locale,
        body: {
          goal_name: goal.name,
          current_amount: goal.current_amount,
          target_amount: goal.target_amount,
          monthly_contribution: goal.monthly_contribution,
          interest_rate: (goal as any).interest_rate || 0,
          interest_frequency: (goal as any).interest_frequency || 'yearly',
          is_locked: (goal as any).is_locked || false,
          bank_name: (goal as any).bank_name || null,
          deadline: goal.deadline,
          start_date: (goal as any).start_date || null,
          contribution_day: (goal as any).contribution_day || null,
          locale,
          currency,
        },
      });
      setSimulation(data);
    } catch (err: any) {
      toast.error(err.message || 'Erreur de simulation');
      setSimulationDialog(null);
    } finally {
      setSimulating(false);
    }
  };

  const handleExportSimulationPDF = async () => {
    if (!simulation || !simulationGoal) return;
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    // Plain-text number formatter safe for jsPDF default font (no unicode spaces/symbols)
    const pdfFmt = (n: number) => {
      const parts = Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      return `${parts} ${currency}`;
    };

    const doc = new jsPDF();
    const isFr = locale === 'fr';
    const title = `Simulation IA - ${simulationGoal.name}`;

    doc.setFontSize(16);
    doc.text(title, 14, 20);

    // Summary — wrap long text properly
    doc.setFontSize(10);
    const summaryLines = doc.splitTextToSize(simulation.summary, 180);
    doc.text(summaryLines, 14, 30);

    let y = 30 + summaryLines.length * 5 + 5;

    const scenarios = [
      { label: isFr ? 'Scenario 1 : Cotisations continues' : 'Scenario 1: Ongoing contributions', data: simulation.continue },
      { label: isFr ? 'Scenario 2 : Arret aujourd\'hui' : 'Scenario 2: Stop today', data: simulation.stop_now },
    ];

    for (const sc of scenarios) {
      if (y > 250) { doc.addPage(); y = 20; }

      doc.setFontSize(12);
      doc.text(sc.label, 14, y);
      y += 7;

      doc.setFontSize(9);
      doc.text(`${isFr ? 'Interets sur 1 an' : 'Interest 1y'}: ${pdfFmt(sc.data.interest_income_1y)}`, 14, y); y += 5;
      doc.text(`${isFr ? 'Interets sur 3 ans' : 'Interest 3y'}: ${pdfFmt(sc.data.interest_income_3y)}`, 14, y); y += 5;
      doc.text(`${isFr ? 'Interets sur 5 ans' : 'Interest 5y'}: ${pdfFmt(sc.data.interest_income_5y)}`, 14, y); y += 5;
      if (sc.data.estimated_goal_date) {
        doc.text(`${isFr ? 'Date d\'atteinte estimee' : 'Estimated goal date'}: ${sc.data.estimated_goal_date}`, 14, y); y += 5;
      }

      if (sc.data.monthly_projections?.length > 0) {
        autoTable(doc, {
          startY: y + 2,
          head: [[isFr ? 'Mois' : 'Month', 'Capital', isFr ? 'Interets' : 'Interest', 'Total']],
          body: sc.data.monthly_projections.map((p: any) => [
            String(p.month), pdfFmt(p.capital), pdfFmt(p.interest_earned), pdfFmt(p.total),
          ]),
          styles: { fontSize: 7, font: 'helvetica' },
          headStyles: { fillColor: [99, 102, 241] },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      } else {
        y += 10;
      }
    }

    // Interest lost
    if (simulation.interest_lost > 0) {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFontSize(10);
      doc.setTextColor(220, 38, 38);
      doc.text(`${isFr ? 'Manque a gagner si arret' : 'Interest lost if stopped'}: ${pdfFmt(simulation.interest_lost)}`, 14, y);
      doc.setTextColor(0, 0, 0);
      y += 10;
    }

    // Recommendations
    if (simulation.recommendations?.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFontSize(12);
      doc.text(isFr ? 'Recommandations IA' : 'AI Recommendations', 14, y); y += 7;
      doc.setFontSize(9);
      for (let i = 0; i < simulation.recommendations.length; i++) {
        if (y > 270) { doc.addPage(); y = 20; }
        const recLines = doc.splitTextToSize(`${i + 1}. ${simulation.recommendations[i]}`, 175);
        doc.text(recLines, 16, y);
        y += recLines.length * 4.5 + 3;
      }
    }

    doc.save(`simulation-${simulationGoal.name.replace(/\s+/g, '_')}.pdf`);
    toast.success(isFr ? 'PDF exporte avec succes' : 'PDF exported successfully');
  };

  const icons = ['🎯', '🏖️', '🏠', '🚗', '💻', '📚', '💍', '🎓', '🛡️', '✈️'];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const currentGoalForWithdraw = goals.find(g => g.id === withdrawDialog);
  const simulationGoal = goals.find(g => g.id === simulationDialog);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="manage" value={activeMainTab} onValueChange={setActiveMainTab}>
        <TabsList className="rounded-xl mb-4 flex-wrap">
          <TabsTrigger value="manage" className="rounded-lg gap-1.5"><PiggyBank className="w-4 h-4" />{t.management}</TabsTrigger>
          <TabsTrigger value="evolution" className="rounded-lg gap-1.5"><TrendingUp className="w-4 h-4" />{locale === 'fr' ? 'Évolution' : 'Evolution'}</TabsTrigger>
          <TabsTrigger value="projections" className="rounded-lg gap-1.5"><BarChart3 className="w-4 h-4" />{t.savingsProjections}</TabsTrigger>
        </TabsList>

        <TabsContent value="evolution">
          <SavingsEvolutionTab />
        </TabsContent>

        <TabsContent value="projections">
          <SavingsProjectionsTab goals={goals} fmt={fmt} />
        </TabsContent>

        <TabsContent value="manage">
      <SavingsHeroHeader
        goals={goals}
        contributions={contributions}
        fmt={fmt}
        isFr={locale === 'fr'}
        view={savingsView}
        onViewChange={setSavingsView}
        onNewGoal={() => {
          setEditGoalId(null);
          setForm({ name: '', target_amount: '', icon: '🎯', deadline: '', account_id: '', monthly_contribution: '', start_date: '', contribution_day: '', is_locked: false, interest_rate: '', interest_frequency: 'yearly', bank_name: '', linked_budget_id: '' });
          setCustomBankMode(false);
          setDialogOpen(true);
        }}
      />

      <SavingsCoachInsights goals={goals} contributions={contributions} fmt={fmt} isFr={locale === 'fr'} />

      {/* Sticky quick-search — keyboard accessible (/ or ⌘F), Esc to clear */}
      <div className="sticky top-14 z-20 -mx-4 lg:-mx-6 px-4 lg:px-6 py-2 backdrop-blur-xl bg-background/70 border-b border-border/40">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={locale === 'fr'
              ? 'Rechercher un objectif ou une banque… (ex: voyage ; cag)'
              : 'Search a goal or bank… (e.g. trip ; cag)'}
            aria-label={locale === 'fr' ? "Rechercher un objectif d'épargne" : 'Search a savings goal'}
            className="pl-9 pr-24 h-10 rounded-xl bg-background/60 border-border/60 focus-visible:ring-primary/40"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60"
              aria-label={locale === 'fr' ? 'Effacer la recherche' : 'Clear search'}
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex absolute right-2 top-1/2 -translate-y-1/2 h-6 items-center gap-0.5 rounded-md border border-border/60 bg-muted/60 px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              /
            </kbd>
          )}
        </div>
        {searchQuery && (
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {locale === 'fr'
              ? `${filteredGoals.length} résultat(s) — Échap pour effacer`
              : `${filteredGoals.length} result(s) — Esc to clear`}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-bold font-display">{t.savings}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {goals.length} {locale === 'fr' ? 'objectif(s)' : 'goal(s)'}
            {goals.length > 0 && ` · ${fmt(goals.reduce((s, g) => s + Number(g.current_amount), 0))} ${locale === 'fr' ? 'épargnés' : 'saved'}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" className="rounded-xl" onClick={handleRecalculate} disabled={recalculating}>
            <Calculator className={`w-4 h-4 mr-1 ${recalculating ? 'animate-spin' : ''}`} />
            {recalculating ? (locale === 'fr' ? 'Recalcul...' : 'Recalculating...') : (locale === 'fr' ? 'Recalculer soldes' : 'Recalculate')}
          </Button>
          <Button size="sm" variant="outline" className="rounded-xl" onClick={handleExportExcel} disabled={filteredGoals.length === 0} title={locale === 'fr' ? 'Exporter la liste filtrée en Excel' : 'Export filtered list to Excel'}>
            <Download className="w-4 h-4 mr-1" />
            {locale === 'fr' ? 'Exporter Excel' : 'Export Excel'}
          </Button>
          <Button size="sm" variant="outline" className="rounded-xl" onClick={handleSyncSavings} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? (t.syncing) : (t.syncSavings)}
          </Button>
          <Button size="sm" variant={showCompleted ? 'default' : 'outline'} className="rounded-xl" onClick={() => setShowCompleted(s => !s)} title={locale === 'fr' ? 'Afficher/Cacher les objectifs atteints' : 'Show/Hide completed goals'}>
            <CheckCircle2 className="w-4 h-4 mr-1" />
            {showCompleted
              ? (locale === 'fr' ? 'Masquer atteints' : 'Hide completed')
              : (locale === 'fr' ? 'Voir atteints' : 'Show completed')}
            {goals.filter(g => (g as any).status === 'completed').length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-secondary/20 text-secondary">
                {goals.filter(g => (g as any).status === 'completed').length}
              </span>
            )}
          </Button>
        </div>
      </div>

      <SavingsGlobalStats goals={goals} contributions={contributions} fmt={fmt} t={t} locale={locale} onCardClick={(action) => {
        if (action === 'evolution') setActiveMainTab('evolution');
        else if (action === 'locked' || action === 'unlocked') { /* could filter goals */ }
      }} />
      <SavingsSummaryTable goals={goals} contributions={contributions} fmt={fmt} t={t} locale={locale} />
      <SavingsControlTable goals={goals} contributions={contributions} fmt={fmt} t={t} locale={locale} />

      <FilterToolbar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={locale === 'fr'
          ? 'Rechercher un objectif ou une banque... (ex: voyage ; cag)'
          : 'Search a goal or bank... (e.g. trip ; cag)'}
        sortOptions={[
          { value: 'name', label: locale === 'fr' ? 'Nom' : 'Name' },
          { value: 'current_amount', label: locale === 'fr' ? 'Épargné' : 'Saved' },
          { value: 'target_amount', label: locale === 'fr' ? 'Objectif' : 'Target' },
        ]}
        sortValue={sortField}
        onSortChange={(v) => setSortField(v as 'name' | 'current_amount' | 'target_amount')}
        sortOrder={sortOrder}
        onSortOrderToggle={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
        totalCount={filteredGoals.length}
      />

      {(() => {
        const activeGoals = filteredGoals.filter(g => (g as any).status !== 'completed');
        const completedGoals = filteredGoals.filter(g => (g as any).status === 'completed');

        const renderGoalCard = (g: typeof goals[0]) => (
            <SavingsGoalCard
              key={g.id}
              goal={g}
              contributions={contributions[g.id] || []}
              fmt={fmt}
              t={t}
              locale={locale}
              onAddSaving={() => {
                setAddAmountDialog(g.id);
                // Pré-remplir avec le montant de cotisation paramétré
                setAddAmount(
                  Number(g.monthly_contribution) > 0
                    ? String(Math.round(Number(g.monthly_contribution)))
                    : ''
                );
                // Pré-sélectionner un compte source : le premier compte non-épargne actif
                // qui n'est pas le compte cible de l'objectif lui-même.
                const candidate = accounts.find(
                  (a) => a.id !== g.account_id && (a as any).type !== 'savings' && (a as any).status !== 'archived'
                );
                setSourceAccountId(candidate?.id || '');
              }}
              onWithdraw={() => {
                if ((g as any).is_locked) {
                  toast.error(t.savingsLockedWarning);
                  return;
                }
                setWithdrawDialog(g.id); setWithdrawAmount(''); setTargetAccountId('');
              }}
              onPartialWithdraw={() => {
                if ((g as any).is_locked) { toast.error(t.savingsLockedWarning); return; }
                setPartialWithdrawId(g.id);
              }}
              onEdit={() => {
                setEditGoalId(g.id);
                setForm({
                  name: g.name, target_amount: String(g.target_amount),
                  icon: g.icon || '🎯', deadline: g.deadline || '',
                  account_id: g.account_id || '',
                  monthly_contribution: g.monthly_contribution ? String(g.monthly_contribution) : '',
                  start_date: g.start_date || '',
                  contribution_day: (g as any).contribution_day ? String((g as any).contribution_day) : '',
                  is_locked: (g as any).is_locked || false,
                  interest_rate: (g as any).interest_rate ? String((g as any).interest_rate) : '',
                  interest_frequency: (g as any).interest_frequency || 'yearly',
                  bank_name: (g as any).bank_name || '',
                  linked_budget_id: (g as any).linked_budget_id || '',
                });
                setCustomBankMode(false);
                setDialogOpen(true);
              }}
              onDelete={() => setDeleteId(g.id)}
              onSimulate={() => handleSimulate(g.id)}
              onCapitalizeInterest={Number((g as any).interest_rate) > 0 && g.account_id ? () => handleCapitalizeInterest(g.id) : undefined}
              isCapitalizing={capitalizingGoalId === g.id}
              onArchive={(g as any).status !== 'completed' && Number(g.current_amount) >= Number(g.target_amount) ? () => handleArchive(g.id) : undefined}
              onReinvest={(g as any).status === 'completed' ? () => handleReinvest(g.id) : undefined}
              onReactivate={(g as any).status === 'completed' ? () => handleReactivate(g.id) : undefined}
            />
        );

        return (
          <>
            {activeGoals.length === 0 && completedGoals.length === 0 ? (
              <Card className="relative overflow-hidden border-0 rounded-3xl bg-gradient-to-br from-primary/5 via-secondary/5 to-transparent">
                <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full blur-3xl opacity-30 bg-secondary" />
                <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full blur-3xl opacity-25 bg-primary" />
                <CardContent className="relative py-16 text-center">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/15 to-secondary/15 ring-1 ring-border/40 mb-5">
                    <PiggyBank className="w-10 h-10 text-primary" />
                  </div>
                  <p className="text-xl font-bold font-display mb-2">
                    {locale === 'fr' ? 'Prêt à passer à l\'action ?' : 'Ready to take action?'}
                  </p>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
                    {locale === 'fr'
                      ? 'Votre Coach vous accompagne — créez votre premier objectif et commencez par un petit défi atteignable 💡'
                      : 'Your Coach is here for you — create your first goal and start with a small achievable challenge 💡'}
                  </p>
                  <Button size="sm" className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={() => {
                    setEditGoalId(null);
                    setForm({ name: '', target_amount: '', icon: '🎯', deadline: '', account_id: '', monthly_contribution: '', start_date: '', contribution_day: '', is_locked: false, interest_rate: '', interest_frequency: 'yearly', bank_name: '', linked_budget_id: '' });
                    setCustomBankMode(false);
                    setDialogOpen(true);
                  }}>
                    <Plus className="w-4 h-4 mr-1" />{t.addGoal}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {activeGoals.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Target className="w-4 h-4" /> {t.activeGoals} ({activeGoals.length})
                    </h3>
                    <VirtualizedGoalsGrid goals={activeGoals} render={renderGoalCard} isLoading={syncing || recalculating} skeletonCount={4} />
                  </div>
                )}
                {showCompleted && completedGoals.length > 0 && (
                  <div className="space-y-4 mt-8">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-secondary flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> {t.completedGoals} ({completedGoals.length})
                    </h3>
                    <VirtualizedGoalsGrid goals={completedGoals} render={renderGoalCard} isLoading={syncing || recalculating} skeletonCount={2} />
                  </div>
                )}
              </>
            )}
          </>
        );
      })()}

      {/* Create/Edit Goal Dialog */}
      <ResponsiveFormDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditGoalId(null); }}
        title={editGoalId ? t.editGoal : t.addGoal}
        description={locale === 'fr' ? (editGoalId ? 'Modifiez votre objectif d\'épargne' : 'Définissez un objectif d\'épargne') : (editGoalId ? 'Edit your savings goal' : 'Set a savings goal')}
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">{t.cancel}</Button>
            <Button className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={handleCreateOrEdit}>{t.save}</Button>
          </>
        }
      >
        <div className="space-y-5 form-animate">
          <FormSection title={locale === 'fr' ? 'Objectif' : 'Goal'} icon={<Target className="w-3.5 h-3.5" />}>
            <InputField
              label={t.goalName}
              icon={<Target className="w-3.5 h-3.5" />}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              maxLength={100}
              charCount
              placeholder={locale === 'fr' ? 'Ex: Vacances, Voiture...' : 'E.g: Vacation, Car...'}
            />
            <div className="space-y-1.5">
              <Label className="form-label">{t.iconLabel}</Label>
              <div className="flex flex-wrap gap-2">
                {icons.map(ic => (
                  <button key={ic} onClick={() => setForm(f => ({ ...f, icon: ic }))}
                    className={`text-xl p-2 rounded-xl border-2 transition-all ${form.icon === ic ? 'border-primary bg-primary/10 scale-110 shadow-sm' : 'border-border hover:bg-muted hover:scale-105'}`}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputField
                label={amountLabel(t.targetAmount, currency)}
                prefix={currencySymbol(currency)}
                type="number"
                min="1"
                step="0.01"
                value={form.target_amount}
                onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))}
              />
              <InputField
                label={amountLabel(t.savingsMonthlyContribution, currency)}
                prefix={currencySymbol(currency)}
                type="number"
                min="0"
                step="0.01"
                value={form.monthly_contribution}
                onChange={e => setForm(f => ({ ...f, monthly_contribution: e.target.value }))}
                placeholder={exampleAmount(currency, locale)}
              />
            </div>
          </FormSection>

          <FormSection title={locale === 'fr' ? 'Paramètres avancés' : 'Advanced settings'} icon={<CalendarDays className="w-3.5 h-3.5" />} collapsible defaultOpen={!!form.account_id || !!form.start_date}>
            <div className="space-y-1.5">
              <Label className="form-label">{t.savingsTargetAccount} ({t.optional})</Label>
              <AccountCombobox accounts={accounts} value={form.account_id} onValueChange={v => setForm(f => ({ ...f, account_id: v }))} placeholder={t.selectAccount} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="form-label">{t.contributionDay}</Label>
                <Select value={form.contribution_day || '__none__'} onValueChange={v => setForm(f => ({ ...f, contribution_day: v === '__none__' ? '' : v }))}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {Array.from({ length: 31 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <InputField
                label={t.startDate}
                type="date"
                value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
              />
              <InputField
                label={locale === 'fr' ? 'Date de fin' : 'End date'}
                type="date"
                value={form.deadline}
                onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
              />
            </div>

            {/* Locked toggle */}
            <div className="flex items-center justify-between bg-muted/50 rounded-xl p-3">
              <div className="flex items-center gap-2">
                {form.is_locked ? <Lock className="w-4 h-4 text-destructive" /> : <Unlock className="w-4 h-4 text-secondary" />}
                <div>
                  <p className="text-sm font-medium">{form.is_locked ? t.savingsIsLocked : t.savingsIsAvailable}</p>
                  <p className="text-xs text-muted-foreground">{locale === 'fr' ? 'Empêche les retraits si bloquée' : 'Prevents withdrawals if locked'}</p>
                </div>
              </div>
              <Switch checked={form.is_locked} onCheckedChange={v => setForm(f => ({ ...f, is_locked: v }))} />
            </div>
          </FormSection>

          {(() => {
            const eligibleBudgets = (budgetsAll || []).filter((b: any) =>
              !b.deleted_at && !b.paused_at && (b.budget_type || 'expense') === 'expense'
            );
            if (eligibleBudgets.length === 0) return null;
            return (
              <FormSection
                title={locale === 'fr' ? 'Lier à un budget' : 'Link to a budget'}
                icon={<Link2 className="w-3.5 h-3.5" />}
                collapsible
                defaultOpen={!!form.linked_budget_id}
              >
                <div className="space-y-1.5">
                  <LinkPicker
                    value={form.linked_budget_id}
                    onChange={(id) => setForm(f => ({ ...f, linked_budget_id: id }))}
                    options={eligibleBudgets.map((b: any) => ({
                      id: b.id,
                      name: b.name,
                      icon: '💰',
                      amount: Number(b.amount) || 0,
                      amountSuffix: locale === 'fr' ? `/${b.period === 'monthly' ? 'mois' : (b.period || 'mois')}` : `/${b.period || 'mo'}`,
                      day: b.expected_day ?? null,
                      linkedToOtherId: b.linked_savings_goal_id || null,
                    }))}
                    fmt={fmt}
                    locale={locale}
                    selfId={editGoalId}
                    placeholder={locale === 'fr' ? 'Aucun budget lié' : 'No linked budget'}
                    emptyHint={locale === 'fr' ? 'Aucun budget de dépense actif' : 'No active expense budget'}
                  />
                  <p className="text-[10px] text-muted-foreground italic">
                    💡 {locale === 'fr'
                      ? 'Le montant, le jour prévu et la date de démarrage seront synchronisés avec le budget lié.'
                      : 'Amount, expected day and start date will sync with the linked budget.'}
                  </p>
                </div>
              </FormSection>
            );
          })()}

          <FormSection title={locale === 'fr' ? 'Banque & Intérêts' : 'Bank & Interest'} icon={<Building2 className="w-3.5 h-3.5" />} collapsible defaultOpen={!!form.bank_name || !!form.interest_rate}>
            <div className="space-y-1.5">
              <Label className="form-label">{t.bankName} ({t.optional})</Label>
              {(() => {
                const bankOptions = [
                  'SGCI', 'BICICI', 'CORIS BANK', 'BOA', 'NSIA Banque', 'SIB', 'BDU',
                  'Ecobank', 'UBA', 'SCB', 'BACI', 'Orange Bank', 'MTN MoMo', 'Wave',
                  'Bridge Bank', 'Banque Atlantique', 'BGFI Bank', 'Standard Chartered',
                  'Orabank', 'Access Bank', 'BNI', 'BIAO-CI',
                ];
                const existingBanks = goals.map(g => (g as any).bank_name).filter(Boolean) as string[];
                const allBanks = [...new Set([...bankOptions, ...existingBanks])].sort();
                const showCustomInput = customBankMode || (form.bank_name !== '' && !allBanks.includes(form.bank_name));
                return (
                  <>
                    <Select
                      value={showCustomInput ? '__custom__' : (form.bank_name || '__none__')}
                      onValueChange={v => {
                        if (v === '__custom__') { setCustomBankMode(true); setForm(f => ({ ...f, bank_name: '' })); }
                        else if (v === '__none__') { setCustomBankMode(false); setForm(f => ({ ...f, bank_name: '' })); }
                        else { setCustomBankMode(false); setForm(f => ({ ...f, bank_name: v })); }
                      }}
                    >
                      <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder={t.bankNamePlaceholder} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{locale === 'fr' ? '— Aucune —' : '— None —'}</SelectItem>
                        {allBanks.map(bank => <SelectItem key={bank} value={bank}>{bank}</SelectItem>)}
                        <SelectItem value="__custom__">{locale === 'fr' ? '✏️ Autre...' : '✏️ Other...'}</SelectItem>
                      </SelectContent>
                    </Select>
                    {showCustomInput && <InputField autoFocus value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} placeholder={t.bankNamePlaceholder} />}
                  </>
                );
              })()}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InputField
                label={t.interestRate}
                icon={<Percent className="w-3.5 h-3.5" />}
                suffix="%"
                type="number"
                min="0"
                step="0.01"
                value={form.interest_rate}
                onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value }))}
                placeholder={locale === 'fr' ? 'Ex : 3,5' : 'E.g. 3.5'}
              />
              <div className="space-y-1.5">
                <Label className="form-label">{t.interestFrequency}</Label>
                <Select value={form.interest_frequency} onValueChange={v => setForm(f => ({ ...f, interest_frequency: v }))}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">{t.interestMonthly}</SelectItem>
                    <SelectItem value="quarterly">{t.interestQuarterly}</SelectItem>
                    <SelectItem value="semi_annual">{t.interestSemiAnnual}</SelectItem>
                    <SelectItem value="yearly">{t.interestYearly}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FormSection>
        </div>
      </ResponsiveFormDialog>

      <AddContributionDialog
        open={!!addAmountDialog}
        onClose={() => { setAddAmountDialog(null); setSourceAccountId(''); }}
        amount={addAmount} setAmount={setAddAmount}
        sourceAccountId={sourceAccountId} setSourceAccountId={setSourceAccountId}
        accounts={accounts} goal={goals.find(g => g.id === addAmountDialog)}
        onSave={handleAddAmount} saving={saving} t={t} locale={locale}
        currency={currency}
        linkedBudget={(() => {
          const g = goals.find(x => x.id === addAmountDialog);
          if (!g) return null;
          const b: any = budgetsAll.find((x: any) => x.linked_savings_goal_id === g.id);
          if (!b) return null;
          return {
            name: b.name,
            categoryName: b.categories?.name || null,
            categoryIcon: b.categories?.icon || null,
          };
        })()}
      />

      <WithdrawDialog
        open={!!withdrawDialog}
        onClose={() => { setWithdrawDialog(null); setTargetAccountId(''); }}
        amount={withdrawAmount} setAmount={setWithdrawAmount}
        targetAccountId={targetAccountId} setTargetAccountId={setTargetAccountId}
        accounts={accounts} goal={currentGoalForWithdraw}
        onSave={handleWithdraw} saving={saving} fmt={fmt} t={t} locale={locale}
        currency={currency}
      />

      {partialWithdrawId && (() => {
        const g = goals.find(x => x.id === partialWithdrawId);
        if (!g || !user) return null;
        return (
          <PartialWithdrawDialog
            open={!!partialWithdrawId}
            onOpenChange={(v) => { if (!v) setPartialWithdrawId(null); }}
            goal={{ id: g.id, name: g.name, current_amount: Number(g.current_amount), user_id: user.id }}
            accounts={accounts}
            onWithdrawn={() => { setPartialWithdrawId(null); refreshData(); }}
            locale={locale}
            currency={currency}
          />
        );
      })()}

      <SimulationDialog
        open={!!simulationDialog}
        onClose={() => { setSimulationDialog(null); setSimulation(null); }}
        goal={simulationGoal} simulation={simulation} simulating={simulating}
        onExportPDF={handleExportSimulationPDF} fmt={fmt} t={t} locale={locale}
      />

      <GoalReachedDialog
        open={!!reachedDialogGoalId}
        onOpenChange={(o) => { if (!o) setReachedDialogGoalId(null); }}
        goal={goals.find(g => g.id === reachedDialogGoalId) ?? null}
        goals={goals}
        accounts={accounts}
        userId={user?.id ?? ''}
        fmt={fmt}
        locale={locale}
        onReinvest={(goalId) => { setReachedDialogGoalId(null); handleReinvest(goalId); }}
        onSuccess={() => { setReachedDialogGoalId(null); refreshData(); invalidateCrossModule(); }}
      />

      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={t.confirmDelete}
        description={t.confirmDeleteMessage}
        cancelLabel={t.cancel}
        confirmLabel={t.delete}
      />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SavingsPage;
