import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import type { Account, SavingsGoal } from '@/hooks/useDashboardData';

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, PiggyBank, RefreshCw, Sparkles, Lock, Unlock, TrendingUp, Lightbulb } from 'lucide-react';
import { FilterToolbar } from '@/components/dashboard/FilterToolbar';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDeleteDialog from '@/components/dashboard/ConfirmDeleteDialog';
import { AccountCombobox } from '@/components/dashboard/AccountCombobox';
import { recalculateAccountBalance } from '@/hooks/useAccountBalance';
import { SavingsGoalCard } from '@/components/dashboard/savings/SavingsGoalCard';
import { SavingsSummaryTable } from '@/components/dashboard/savings/SavingsSummaryTable';
import { SavingsControlTable } from '@/components/dashboard/savings/SavingsControlTable';
import { SavingsGlobalStats } from '@/components/dashboard/savings/SavingsGlobalStats';

interface SimulationResult {
  monthly_projections: { month: number; capital: number; interest_earned: number; total: number }[];
  interest_income_1y: number;
  interest_income_3y: number;
  interest_income_5y: number;
  estimated_goal_date?: string;
  recommendations: string[];
  summary: string;
}

const SavingsPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const t = dashT[locale];
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'name' | 'current_amount' | 'target_amount'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contributions, setContributions] = useState<Record<string, SavingsContribution[]>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editGoalId, setEditGoalId] = useState<string | null>(null);
  const [addAmountDialog, setAddAmountDialog] = useState<string | null>(null);
  const [withdrawDialog, setWithdrawDialog] = useState<string | null>(null);
  const [addAmount, setAddAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [targetAccountId, setTargetAccountId] = useState('');
  const [form, setForm] = useState({
    name: '', target_amount: '', icon: '🎯', deadline: '', account_id: '',
    monthly_contribution: '', start_date: '',
    is_locked: false, interest_rate: '', interest_frequency: 'yearly', bank_name: '',
  });
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [simulationDialog, setSimulationDialog] = useState<string | null>(null);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [customBankMode, setCustomBankMode] = useState(false);

  const fmt = (n: number) => fmtCurrency(n, locale);

  const filteredGoals = useMemo(() => {
    let result = [...goals];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(g => g.name.toLowerCase().includes(q) || (g as any).bank_name?.toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'current_amount') cmp = Number(a.current_amount) - Number(b.current_amount);
      else if (sortField === 'target_amount') cmp = Number(a.target_amount) - Number(b.target_amount);
      return sortOrder === 'desc' ? -cmp : cmp;
    });
    return result;
  }, [goals, searchQuery, sortField, sortOrder]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [goalsRes, accRes, txRes] = await Promise.all([
      supabase.from('savings_goals').select('*, payment_accounts(name, icon, real_balance)').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('payment_accounts').select('*').eq('user_id', user.id),
      supabase.from('transactions').select('id, amount, date, notes, type, account_id, description, payment_accounts:account_id(name, icon)')
        .eq('user_id', user.id)
        .like('notes', '🎯 %')
        .order('date', { ascending: false })
        .limit(500),
    ]);

    const goalsData = goalsRes.data || [];
    setGoals(goalsData);
    setAccounts(accRes.data || []);

    const contribMap: Record<string, any[]> = {};
    for (const goal of goalsData) {
      contribMap[goal.id] = [];
    }
    for (const tx of (txRes.data || [])) {
      const goalName = tx.notes?.replace('🎯 ', '') || '';
      const matchedGoal = goalsData.find((g: any) => g.name === goalName);
      if (matchedGoal) {
        contribMap[matchedGoal.id] = contribMap[matchedGoal.id] || [];
        const desc = tx.description || '';
        const isSavingsTx = desc.startsWith(`${t.savings}:`);
        if (isSavingsTx) {
          const isWithdrawal = desc.includes('↩');
          contribMap[matchedGoal.id].push({
            id: tx.id,
            amount: tx.amount,
            date: tx.date,
            type: isWithdrawal ? 'withdrawal' : 'deposit',
            account_name: (tx.payment_accounts as any)?.name,
            account_icon: (tx.payment_accounts as any)?.icon,
          });
        }
      }
    }
    setContributions(contribMap);
    setLoading(false);
  }, [user, t.savings]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Sync savings from imported transactions
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
        toast.info(locale === 'fr' ? 'Aucune transaction d\'épargne trouvée' : 'No savings transactions found');
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

      await fetchData();
      toast.success(locale === 'fr' ? `${updated} objectif(s) synchronisé(s)` : `${updated} goal(s) synced`);
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateOrEdit = async () => {
    if (!user || !form.name.trim() || Number(form.target_amount) <= 0) return;
    const payload = {
      name: form.name.trim(),
      target_amount: Number(form.target_amount),
      icon: form.icon || '🎯',
      deadline: form.deadline || null,
      account_id: form.account_id || null,
      monthly_contribution: form.monthly_contribution ? Number(form.monthly_contribution) : 0,
      start_date: form.start_date || null,
      is_locked: form.is_locked,
      interest_rate: form.interest_rate ? Number(form.interest_rate) : 0,
      interest_frequency: form.interest_frequency || 'yearly',
      bank_name: form.bank_name?.trim() || null,
    };

    if (editGoalId) {
      const { error } = await supabase.from('savings_goals').update(payload).eq('id', editGoalId);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from('savings_goals').insert({ user_id: user.id, ...payload });
      if (error) { toast.error(error.message); return; }
    }
    setDialogOpen(false);
    setEditGoalId(null);
    fetchData();
    toast.success(t.saved);
  };

  const handleAddAmount = async () => {
    if (!addAmountDialog || Number(addAmount) <= 0 || !user) return;
    const goal = goals.find(g => g.id === addAmountDialog);
    if (!goal) return;

    setSaving(true);
    try {
      const amountToAdd = Number(addAmount);
      const today = new Date().toISOString().split('T')[0];

      if (sourceAccountId) {
        await supabase.from('transactions').insert({
          user_id: user.id, type: 'expense', amount: amountToAdd,
          description: `${t.savings}: ${goal.name}`, account_id: sourceAccountId,
          date: today, notes: `🎯 ${goal.name}`,
        });
        await recalculateAccountBalance(sourceAccountId);
      }

      if (goal.account_id) {
        await supabase.from('transactions').insert({
          user_id: user.id, type: 'income', amount: amountToAdd,
          description: `${t.savings}: ${goal.name}`, account_id: goal.account_id,
          date: today, notes: `🎯 ${goal.name}`,
        });
        await recalculateAccountBalance(goal.account_id);
      }

      await supabase.from('savings_goals').update({
        current_amount: Number(goal.current_amount) + amountToAdd,
      }).eq('id', addAmountDialog);

      setAddAmountDialog(null);
      setAddAmount('');
      setSourceAccountId('');
      fetchData();
      toast.success(t.saved);
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawDialog || Number(withdrawAmount) <= 0 || !user) return;
    const goal = goals.find(g => g.id === withdrawDialog);
    if (!goal) return;

    // Check if locked
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

      if (goal.account_id) {
        await supabase.from('transactions').insert({
          user_id: user.id, type: 'expense', amount,
          description: `${t.savings}: ${goal.name} ↩`, account_id: goal.account_id,
          date: today, notes: `🎯 ${goal.name}`,
        });
        await recalculateAccountBalance(goal.account_id);
      }

      if (targetAccountId) {
        await supabase.from('transactions').insert({
          user_id: user.id, type: 'income', amount,
          description: `${t.savings}: ${goal.name} ↩`, account_id: targetAccountId,
          date: today, notes: `🎯 ${goal.name}`,
        });
        await recalculateAccountBalance(targetAccountId);
      }

      await supabase.from('savings_goals').update({
        current_amount: Math.max(0, Number(goal.current_amount) - amount),
      }).eq('id', withdrawDialog);

      setWithdrawDialog(null);
      setWithdrawAmount('');
      setTargetAccountId('');
      fetchData();
      toast.success(t.saved);
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('savings_goals').delete().eq('id', deleteId);
    setDeleteId(null);
    fetchData();
  };

  // AI Simulation
  const handleSimulate = async (goalId: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    setSimulationDialog(goalId);
    setSimulation(null);
    setSimulating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-savings-simulate', {
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
          locale,
          currency,
        },
      });
      if (error) throw error;
      setSimulation(data);
    } catch (err: any) {
      toast.error(err.message || 'Erreur de simulation');
      setSimulationDialog(null);
    } finally {
      setSimulating(false);
    }
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
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const currentGoalForWithdraw = goals.find(g => g.id === withdrawDialog);
  const simulationGoal = goals.find(g => g.id === simulationDialog);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold font-display">{t.savings}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {goals.length} {locale === 'fr' ? 'objectif(s)' : 'goal(s)'}
            {goals.length > 0 && ` · ${fmt(goals.reduce((s, g) => s + Number(g.current_amount), 0))} ${locale === 'fr' ? 'épargnés' : 'saved'}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="rounded-xl" onClick={handleSyncSavings} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? (t.syncing) : (t.syncSavings)}
          </Button>
          <Button size="sm" className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={() => {
            setEditGoalId(null);
            setForm({ name: '', target_amount: '', icon: '🎯', deadline: '', account_id: '', monthly_contribution: '', start_date: '', is_locked: false, interest_rate: '', interest_frequency: 'yearly', bank_name: '' });
            setCustomBankMode(false);
            setDialogOpen(true);
          }}>
            <Plus className="w-4 h-4 mr-1" />{t.addGoal}
          </Button>
        </div>
      </div>

      <SavingsGlobalStats goals={goals} contributions={contributions} fmt={fmt} t={t} locale={locale} />
      <SavingsSummaryTable goals={goals} contributions={contributions} fmt={fmt} t={t} locale={locale} />
      <SavingsControlTable goals={goals} contributions={contributions} fmt={fmt} t={t} locale={locale} />

      {goals.length === 0 ? (
        <Card className="border border-border/50 shadow-[var(--shadow-card)] rounded-2xl">
          <CardContent className="py-16 text-center">
            <PiggyBank className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-lg font-medium text-muted-foreground mb-2">{t.noGoals}</p>
            <Button size="sm" className="text-primary-foreground mt-2 rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={() => {
              setEditGoalId(null);
              setForm({ name: '', target_amount: '', icon: '🎯', deadline: '', account_id: '', monthly_contribution: '', start_date: '', is_locked: false, interest_rate: '', interest_frequency: 'yearly', bank_name: '' });
              setCustomBankMode(false);
              setDialogOpen(true);
            }}>
              <Plus className="w-4 h-4 mr-1" />{t.addGoal}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {goals.map(g => (
            <SavingsGoalCard
              key={g.id}
              goal={g}
              contributions={contributions[g.id] || []}
              fmt={fmt}
              t={t}
              locale={locale}
              onAddSaving={() => { setAddAmountDialog(g.id); setAddAmount(''); setSourceAccountId(''); }}
              onWithdraw={() => {
                if ((g as any).is_locked) {
                  toast.error(t.savingsLockedWarning);
                  return;
                }
                setWithdrawDialog(g.id); setWithdrawAmount(''); setTargetAccountId('');
              }}
              onEdit={() => {
                setEditGoalId(g.id);
                setForm({
                  name: g.name, target_amount: String(g.target_amount),
                  icon: g.icon || '🎯', deadline: g.deadline || '',
                  account_id: g.account_id || '',
                  monthly_contribution: g.monthly_contribution ? String(g.monthly_contribution) : '',
                  start_date: g.start_date || '',
                  is_locked: (g as any).is_locked || false,
                  interest_rate: (g as any).interest_rate ? String((g as any).interest_rate) : '',
                  interest_frequency: (g as any).interest_frequency || 'yearly',
                  bank_name: (g as any).bank_name || '',
                });
                setCustomBankMode(false);
                setDialogOpen(true);
              }}
              onDelete={() => setDeleteId(g.id)}
              onSimulate={() => handleSimulate(g.id)}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Goal Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditGoalId(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{editGoalId ? t.editGoal : t.addGoal}</DialogTitle>
            <DialogDescription>{locale === 'fr' ? (editGoalId ? 'Modifiez votre objectif d\'épargne' : 'Définissez un objectif d\'épargne') : (editGoalId ? 'Edit your savings goal' : 'Set a savings goal')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.goalName}</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} maxLength={100} className="rounded-xl h-11" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.iconLabel}</Label>
              <div className="flex flex-wrap gap-2">
                {icons.map(ic => (
                  <button key={ic} onClick={() => setForm(f => ({ ...f, icon: ic }))}
                    className={`text-xl p-1.5 rounded-lg border-2 transition-colors ${form.icon === ic ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t.savingsTargetAccount} ({t.optional})
              </Label>
              <AccountCombobox accounts={accounts} value={form.account_id} onValueChange={v => setForm(f => ({ ...f, account_id: v }))} placeholder={t.selectAccount} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.targetAmount}</Label>
                <Input type="number" min="1" step="0.01" value={form.target_amount} onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))} className="rounded-xl h-11" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.savingsMonthlyContribution}</Label>
                <Input type="number" min="0" step="0.01" value={form.monthly_contribution} onChange={e => setForm(f => ({ ...f, monthly_contribution: e.target.value }))} className="rounded-xl h-11" placeholder={locale === 'fr' ? 'Ex: 50 000' : 'E.g. 500'} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.startDate}</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="rounded-xl h-11" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{locale === 'fr' ? 'Date de fin' : 'End date'}</Label>
                <Input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} className="rounded-xl h-11" />
              </div>
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

            {/* Bank */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.bankName} ({t.optional})</Label>
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
                      <SelectTrigger className="rounded-xl h-11">
                        <SelectValue placeholder={t.bankNamePlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{locale === 'fr' ? '— Aucune —' : '— None —'}</SelectItem>
                        {allBanks.map(bank => (
                          <SelectItem key={bank} value={bank}>{bank}</SelectItem>
                        ))}
                        <SelectItem value="__custom__">{locale === 'fr' ? '✏️ Autre...' : '✏️ Other...'}</SelectItem>
                      </SelectContent>
                    </Select>
                    {showCustomInput && (
                      <Input autoFocus value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} className="rounded-xl h-11 mt-2" placeholder={t.bankNamePlaceholder} />
                    )}
                  </>
                );
              })()}
            </div>

            {/* Interest rate & frequency */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.interestRate}</Label>
                <Input type="number" min="0" step="0.01" value={form.interest_rate} onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value }))} className="rounded-xl h-11" placeholder="Ex: 3.5" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.interestFrequency}</Label>
                <Select value={form.interest_frequency} onValueChange={v => setForm(f => ({ ...f, interest_frequency: v }))}>
                  <SelectTrigger className="rounded-xl h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">{t.interestMonthly}</SelectItem>
                    <SelectItem value="quarterly">{t.interestQuarterly}</SelectItem>
                    <SelectItem value="semi_annual">{t.interestSemiAnnual}</SelectItem>
                    <SelectItem value="yearly">{t.interestYearly}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">{t.cancel}</Button>
            <Button className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={handleCreateOrEdit}>{t.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Contribution Dialog */}
      <Dialog open={!!addAmountDialog} onOpenChange={() => { setAddAmountDialog(null); setSourceAccountId(''); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{t.addSaving}</DialogTitle>
            <DialogDescription>
              {locale === 'fr' ? 'Ajoutez un versement à cet objectif.' : 'Add a contribution to this goal.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.amount}</Label>
              <Input type="number" min="0.01" step="0.01" value={addAmount} onChange={e => setAddAmount(e.target.value)} className="rounded-xl h-11 text-lg font-bold" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t.savingsSourceAccount} ({t.optional})
              </Label>
              <AccountCombobox
                accounts={accounts}
                value={sourceAccountId}
                onValueChange={setSourceAccountId}
                placeholder={locale === 'fr' ? 'Débiter depuis...' : 'Debit from...'}
                excludeId={goals.find(g => g.id === addAmountDialog)?.account_id}
              />
            </div>
            {goals.find(g => g.id === addAmountDialog)?.payment_accounts && (
              <div className="bg-muted/50 rounded-xl p-3 text-sm">
                <span className="text-muted-foreground">{t.savingsTargetAccount}: </span>
                <span className="font-medium">
                  {goals.find(g => g.id === addAmountDialog)?.payment_accounts?.icon}{' '}
                  {goals.find(g => g.id === addAmountDialog)?.payment_accounts?.name}
                </span>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setAddAmountDialog(null); setSourceAccountId(''); }} className="rounded-xl">{t.cancel}</Button>
            <Button className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={handleAddAmount} disabled={saving}>
              {saving ? t.saving : t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw Dialog */}
      <Dialog open={!!withdrawDialog} onOpenChange={() => { setWithdrawDialog(null); setTargetAccountId(''); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{t.withdrawSaving}</DialogTitle>
            <DialogDescription>{t.savingsWithdrawDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-xl p-3 text-sm">
              <span className="text-muted-foreground">{locale === 'fr' ? 'Disponible' : 'Available'}: </span>
              <span className="font-bold">{fmt(Number(currentGoalForWithdraw?.current_amount || 0))}</span>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.withdrawAmount}</Label>
              <Input
                type="number" min="0.01" step="0.01"
                max={currentGoalForWithdraw?.current_amount || 0}
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
                className="rounded-xl h-11 text-lg font-bold"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t.savingsTargetAccount} ({t.optional})
              </Label>
              <AccountCombobox
                accounts={accounts}
                value={targetAccountId}
                onValueChange={setTargetAccountId}
                placeholder={locale === 'fr' ? 'Créditer vers...' : 'Credit to...'}
                excludeId={currentGoalForWithdraw?.account_id}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setWithdrawDialog(null); setTargetAccountId(''); }} className="rounded-xl">{t.cancel}</Button>
            <Button variant="destructive" className="rounded-xl" onClick={handleWithdraw} disabled={saving}>
              {saving ? t.saving : t.withdrawSaving}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Simulation Dialog */}
      <Dialog open={!!simulationDialog} onOpenChange={() => { setSimulationDialog(null); setSimulation(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {t.simulationTitle}
              {simulationGoal && <span className="text-muted-foreground font-normal">— {simulationGoal.icon} {simulationGoal.name}</span>}
            </DialogTitle>
          </DialogHeader>
          {simulating ? (
            <div className="py-12 text-center space-y-3">
              <Sparkles className="w-8 h-8 text-primary mx-auto animate-pulse" />
              <p className="text-sm text-muted-foreground">{t.simulating}</p>
            </div>
          ) : simulation ? (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-muted/50 rounded-xl p-4">
                <p className="text-sm">{simulation.summary}</p>
              </div>

              {/* Interest income */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-primary/10 rounded-xl p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{t.interestIncome1y}</p>
                  <p className="text-lg font-bold text-primary mt-1">{fmt(simulation.interest_income_1y)}</p>
                </div>
                <div className="bg-primary/10 rounded-xl p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{t.interestIncome3y}</p>
                  <p className="text-lg font-bold text-primary mt-1">{fmt(simulation.interest_income_3y)}</p>
                </div>
                <div className="bg-primary/10 rounded-xl p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{t.interestIncome5y}</p>
                  <p className="text-lg font-bold text-primary mt-1">{fmt(simulation.interest_income_5y)}</p>
                </div>
              </div>

              {simulation.estimated_goal_date && (
                <div className="bg-secondary/10 rounded-xl p-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-secondary" />
                  <span className="text-sm"><strong>{t.estimatedGoalDate}:</strong> {simulation.estimated_goal_date}</span>
                </div>
              )}

              {/* Monthly projections table */}
              {simulation.monthly_projections?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{t.monthlyProjection}</h4>
                  <div className="overflow-x-auto rounded-xl border border-border/50">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left p-2 font-medium">{locale === 'fr' ? 'Mois' : 'Month'}</th>
                          <th className="text-right p-2 font-medium">{locale === 'fr' ? 'Capital' : 'Capital'}</th>
                          <th className="text-right p-2 font-medium">{locale === 'fr' ? 'Intérêts' : 'Interest'}</th>
                          <th className="text-right p-2 font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {simulation.monthly_projections.map((p) => (
                          <tr key={p.month} className="border-t border-border/30">
                            <td className="p-2">{p.month}</td>
                            <td className="text-right p-2">{fmt(p.capital)}</td>
                            <td className="text-right p-2 text-secondary">{fmt(p.interest_earned)}</td>
                            <td className="text-right p-2 font-bold">{fmt(p.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {simulation.recommendations?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                    <Lightbulb className="w-3.5 h-3.5" />
                    {t.aiRecommendations}
                  </h4>
                  <div className="space-y-2">
                    {simulation.recommendations.map((r, i) => (
                      <div key={i} className="bg-muted/40 rounded-lg p-3 text-sm flex gap-2">
                        <span className="text-primary font-bold">{i + 1}.</span>
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={t.confirmDelete}
        description={t.confirmDeleteMessage}
        cancelLabel={t.cancel}
        confirmLabel={t.delete}
      />
    </div>
  );
};

export default SavingsPage;
