import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { useSubscription } from '@/hooks/useSubscription';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ResponsiveFormDialog } from '@/components/ui/responsive-form-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, Wallet, TrendingUp, TrendingDown, AlertTriangle, Inbox, ArrowLeftRight, Coins, History, BarChart3, Eye, Printer } from 'lucide-react';
import { FilterToolbar } from '@/components/dashboard/FilterToolbar';
import AccountsRecapTab from '@/components/dashboard/tabs/AccountsRecapTab';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDeleteDialog from '@/components/dashboard/ConfirmDeleteDialog';
import UpgradeBanner from '@/components/dashboard/UpgradeBanner';
import BulkActionBar from '@/components/dashboard/BulkActionBar';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { exportToCSV, exportToExcel } from '@/lib/export';
import { TransferDialog } from '@/components/dashboard/TransferDialog';
import CashCountDialog from '@/components/dashboard/CashCountDialog';
import { AccountsPeriodStats } from '@/components/dashboard/accounts/AccountsPeriodStats';

import type { DashTranslations } from '@/i18n/dashTranslations';
import { useInvalidate, useAccounts, useAccountTheoreticalBalances, useAccountCashCounts } from '@/hooks/useDashboardData';
import type { Account, Transaction } from '@/hooks/useDashboardData';

const getAccountTypes = (t: DashTranslations) => [
  { value: 'mobile_money', label: `📱 ${t.mobileMoney}`, icon: '📱' },
  { value: 'bank', label: `🏦 ${t.bank}`, icon: '🏦' },
  { value: 'cash', label: `💵 ${t.cash}`, icon: '💵' },
  { value: 'card', label: `💳 ${t.card}`, icon: '💳' },
  { value: 'savings', label: `🏦 ${t.savingsType}`, icon: '🏦' },
];

const ICONS = ['💳', '📱', '🏦', '💵', '🌊', '🟠', '🟡', '🔵', '💰', '🏧'];

const AccountsPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency, currency } = useProfile();
  const { limits, isPremium } = useSubscription();
  const t = dashT[locale];
  const [searchParams, setSearchParams] = useSearchParams();
  const typeFilter = searchParams.get('type') || '';
  const initialSearch = searchParams.get('q') || '';
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [theoreticalBalances, setTheoreticalBalances] = useState<Record<string, number>>({});
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [updateBalanceDialog, setUpdateBalanceDialog] = useState<Account | null>(null);
  const [newRealBalance, setNewRealBalance] = useState('');
  const [form, setForm] = useState({ name: '', type: 'mobile_money', icon: '💳', opening_balance: '0' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [cashCountAccount, setCashCountAccount] = useState<Account | null>(null);
  const [cashCounts, setCashCounts] = useState<Record<string, { counted_at: string; total_counted: number }>>({});
  const [historyAccountId, setHistoryAccountId] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [previewCashCount, setPreviewCashCount] = useState<any | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [sortField, setSortField] = useState<'name' | 'real_balance' | 'type'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filteredAccounts = useMemo(() => {
    let result = accounts;
    if (typeFilter) result = result.filter(a => a.type === typeFilter);
    if (searchQuery) {
      const terms = searchQuery.split(';').map(s => s.trim().toLowerCase()).filter(Boolean);
      result = result.filter(a => terms.some(q => a.name.toLowerCase().includes(q) || a.type.toLowerCase().includes(q)));
    }
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'real_balance') cmp = Number(a.real_balance) - Number(b.real_balance);
      else if (sortField === 'type') cmp = a.type.localeCompare(b.type);
      return sortOrder === 'desc' ? -cmp : cmp;
    });
    return result;
  }, [accounts, typeFilter, searchQuery, sortField, sortOrder]);

  const bulk = useBulkSelection(filteredAccounts);

  const handleBulkDelete = async () => {
    const ids = Array.from(bulk.selectedIds);
    const { error } = await supabase.from('payment_accounts').delete().in('id', ids);
    if (error) { toast.error(error.message); setBulkDeleteOpen(false); return; }
    setBulkDeleteOpen(false); bulk.clear(); refreshAll();
    toast.success(t.bulkDeleted(ids.length));
  };

  const handleBulkExport = (format: 'csv' | 'excel') => {
    const data = bulk.selectedItems.map(a => ({
      [t.accountName]: a.name, [t.type]: a.type, [t.openingBalance]: a.opening_balance, [t.realBalance]: a.real_balance,
    }));
    const ok = format === 'csv' ? exportToCSV(data, 'accounts') : exportToExcel(data, 'accounts');
    if (ok) toast.success(t.saved);
  };

  const fmt = (n: number) => fmtCurrency(n, locale);
  const { invalidate } = useInvalidate();

  // Wrapper to also invalidate react-query caches
  const refreshAll = () => {
    fetchData();
    invalidate('accounts', 'transactions', 'paginated-transactions', 'chart-data', 'all-transactions');
  };

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [accRes, balRes, ccRes] = await Promise.all([
      supabase.from('payment_accounts').select('*').eq('user_id', user.id).order('created_at'),
      supabase.rpc('get_account_theoretical_balances', { p_user_id: user.id }),
      supabase.from('cash_counts').select('account_id, counted_at, total_counted').eq('user_id', user.id).order('counted_at', { ascending: false }),
    ]);
    const accs = accRes.data || [];
    setAccounts(accs);
    setAllTransactions([]); // No longer loading all transactions
    // Build theoretical balances from RPC
    const balances: Record<string, number> = {};
    for (const row of (balRes.data || [])) {
      balances[row.account_id] = Number(row.theoretical_balance);
    }
    setTheoreticalBalances(balances);
    // Build map of latest cash count per account
    const latestMap: Record<string, { counted_at: string; total_counted: number }> = {};
    (ccRes.data || []).forEach(cc => {
      if (cc.account_id && !latestMap[cc.account_id]) {
        latestMap[cc.account_id] = { counted_at: cc.counted_at!, total_counted: Number(cc.total_counted) };
      }
    });
    setCashCounts(latestMap);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getTheoreticalBalance = (accountId: string) => {
    return theoreticalBalances[accountId] ?? Number(accounts.find(a => a.id === accountId)?.opening_balance || 0);
  };

  const accountLimitReached = !isPremium && accounts.length >= limits.accounts;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = t.nameRequired;
    if (form.name.trim().length > 100) errs.name = t.maxChars(100);
    if (Number(form.opening_balance) < 0) errs.opening_balance = locale === 'fr' ? 'Le solde ne peut pas être négatif' : 'Balance cannot be negative';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const openNew = () => {
    if (accountLimitReached) {
      toast.error(t.limitAccountsToast(limits.accounts));
      return;
    }
    setEditing(null);
    setErrors({});
    setForm({ name: '', type: 'mobile_money', icon: '💳', opening_balance: '0' });
    setDialogOpen(true);
  };

  const openEdit = (acc: any) => {
    setEditing(acc);
    setErrors({});
    setForm({ name: acc.name, type: acc.type, icon: acc.icon, opening_balance: String(acc.opening_balance) });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !validate()) return;
    setSaving(true);
    const openingBal = Number(form.opening_balance) || 0;
    const payload = {
      user_id: user.id, name: form.name.trim(), type: form.type, icon: form.icon,
      opening_balance: openingBal,
      real_balance: editing ? undefined : openingBal,
    };
    if (editing) {
      const { real_balance, ...updatePayload } = payload;
      const { error } = await supabase.from('payment_accounts').update(updatePayload).eq('id', editing.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      const { data: newAcc, error } = await supabase.from('payment_accounts').insert(payload).select('id').single();
      if (error) { toast.error(error.message); setSaving(false); return; }
      // opening_balance is already used by recalculate_account_balance (opening_balance + income - expense)
      // so we do NOT insert a transaction — that would double-count it
    }
    setSaving(false);
    setDialogOpen(false);
    refreshAll();
    toast.success(t.saved);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('payment_accounts').delete().eq('id', deleteId);
    setDeleteId(null);
    refreshAll();
    toast.success(t.delete + ' ✓');
  };

  const handleUpdateRealBalance = async () => {
    if (!updateBalanceDialog) return;
    const { error } = await supabase.from('payment_accounts').update({ real_balance: Number(newRealBalance) }).eq('id', updateBalanceDialog.id);
    if (error) { toast.error(error.message); return; }
    setUpdateBalanceDialog(null);
    refreshAll();
    toast.success(t.saved);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="manage">
        <TabsList className="rounded-xl mb-4">
          <TabsTrigger value="manage" className="rounded-lg gap-1.5"><Wallet className="w-4 h-4" />{t.management}</TabsTrigger>
          <TabsTrigger value="stats" className="rounded-lg gap-1.5"><BarChart3 className="w-4 h-4" />{locale === 'fr' ? 'Stats période' : 'Period stats'}</TabsTrigger>
          <TabsTrigger value="recap" className="rounded-lg gap-1.5"><Eye className="w-4 h-4" />{t.accountsRecap}</TabsTrigger>
        </TabsList>

        <TabsContent value="recap">
          <AccountsRecapTab />
        </TabsContent>

        <TabsContent value="stats">
          <AccountsPeriodStats accounts={accounts} transactions={allTransactions} fmt={fmt} t={t} locale={locale} />
        </TabsContent>

        <TabsContent value="manage">
      {accountLimitReached && (
        <UpgradeBanner message={t.limitAccountsReached(limits.accounts)} />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          {typeFilter && (
            <button onClick={() => setSearchParams({})} className="text-xs text-muted-foreground hover:text-foreground mb-1 flex items-center gap-1 transition-colors">
              ← {locale === 'fr' ? 'Retour à tous les comptes' : 'Back to all accounts'}
            </button>
          )}
          <h2 className="text-2xl font-bold font-display">{t.accounts}</h2>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setTransferOpen(true)} disabled={accounts.length < 2}>
            <ArrowLeftRight className="w-4 h-4 mr-1" />{t.makeTransfer}
          </Button>
          <Button size="sm" className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={openNew} disabled={accountLimitReached}>
            <Plus className="w-4 h-4 mr-1" />{t.addAccount}
          </Button>
        </div>
      </div>

      {/* Search + Sort + Type filter */}
      {accounts.length > 0 && (
        <FilterToolbar
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={locale === 'fr' ? 'Rechercher un compte...' : 'Search accounts...'}
          sortOptions={[
            { value: 'name', label: locale === 'fr' ? 'Nom' : 'Name' },
            { value: 'real_balance', label: locale === 'fr' ? 'Solde' : 'Balance' },
            { value: 'type', label: t.type },
          ]}
          sortValue={sortField}
          onSortChange={v => setSortField(v as any)}
          sortOrder={sortOrder}
          onSortOrderToggle={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
          filterChips={[...new Set(accounts.map(a => a.type))].map(type => {
            const typeLabels: Record<string, Record<string, string>> = {
              fr: { bank: 'Banque', mobile_money: 'Mobile Money', cash: 'Espèces', card: 'Carte', savings: 'Épargne' },
              en: { bank: 'Bank', mobile_money: 'Mobile Money', cash: 'Cash', card: 'Card', savings: 'Savings' },
            };
            const icons: Record<string, string> = { bank: '🏦', mobile_money: '📱', cash: '💵', card: '💳', savings: '🐖' };
            const labels = typeLabels[locale] || typeLabels.en;
            return { value: type, label: labels[type] || type, icon: icons[type] || '💳', count: accounts.filter(a => a.type === type).length };
          })}
          activeFilter={typeFilter}
          onFilterChange={v => setSearchParams(v ? { type: v } : {})}
          allLabel={locale === 'fr' ? 'Tous' : 'All'}
          totalCount={accounts.length}
        />
      )}


      {bulk.hasSelection && (
        <BulkActionBar
          count={bulk.count}
          onDelete={() => setBulkDeleteOpen(true)}
          onExportCSV={() => handleBulkExport('csv')}
          onExportExcel={() => handleBulkExport('excel')}
          onClear={bulk.clear}
        />
      )}

      {filteredAccounts.length === 0 && accounts.length > 0 ? (
        <Card className="border border-border/50 shadow-[var(--shadow-card)] rounded-2xl">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">{locale === 'fr' ? 'Aucun compte de ce type' : 'No accounts of this type'}</p>
          </CardContent>
        </Card>
      ) : accounts.length === 0 ? (
        <Card className="border border-border/50 shadow-[var(--shadow-card)] rounded-2xl">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center">
              <Wallet className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <p className="text-lg font-semibold text-muted-foreground mb-2">{t.noAccounts}</p>
            <p className="text-sm text-muted-foreground/70 mb-4">{t.addFirstAccount}</p>
            <Button size="sm" className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={openNew}>
              <Plus className="w-4 h-4 mr-1" />{t.addAccount}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredAccounts.map(acc => {
            const theoretical = getTheoreticalBalance(acc.id);
            const real = Number(acc.real_balance);
            const discrepancy = real - theoretical;
            const isSelected = bulk.selectedIds.has(acc.id);
            return (
              <Card key={acc.id} className={`card-interactive hover:-translate-y-1 glow-primary ${Math.abs(discrepancy) > 0.01 ? 'ring-1 ring-destructive/20' : ''} ${isSelected ? 'ring-2 ring-primary/40' : ''}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2.5">
                      <Checkbox checked={isSelected} onCheckedChange={() => bulk.toggle(acc.id)} className="mr-1" />
                      <div className="w-10 h-10 rounded-xl bg-muted/80 flex items-center justify-center text-xl">
                        {acc.icon}
                      </div>
                      <div>
                        <span>{acc.name}</span>
                        <p className="text-[11px] font-normal text-muted-foreground">{getAccountTypes(t).find(at => at.value === acc.type)?.label || acc.type}</p>
                      </div>
                    </CardTitle>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => openEdit(acc)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive" onClick={() => setDeleteId(acc.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-muted/40 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.openingBalance}</p>
                      <p className="text-sm font-bold">{fmt(Number(acc.opening_balance))}</p>
                    </div>
                    <div className="rounded-xl bg-secondary/5 border border-secondary/10 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.theoreticalBalance}</p>
                      <p className="text-sm font-bold text-secondary flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />{fmt(theoretical)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-muted/40 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.realBalance}</p>
                      <p className="text-sm font-bold">{fmt(real)}</p>
                    </div>
                    <div className={`rounded-xl p-3 ${Math.abs(discrepancy) > 0.01 ? 'bg-destructive/5 border border-destructive/10' : 'bg-muted/40'}`}>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.discrepancy}</p>
                      <p className={`text-sm font-bold flex items-center gap-1 ${Math.abs(discrepancy) > 0.01 ? 'text-destructive' : 'text-secondary'}`}>
                        {Math.abs(discrepancy) > 0.01 && <AlertTriangle className="w-3 h-3" />}
                        {discrepancy >= 0 ? '+' : ''}{fmt(discrepancy)}
                      </p>
                    </div>
                  </div>
                  {acc.type === 'cash' ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 text-xs rounded-xl gap-1.5 border-accent text-accent-foreground hover:bg-accent/10" onClick={() => setCashCountAccount(acc)}>
                          <Coins className="w-3.5 h-3.5 text-accent" />
                          {t.cashCount}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-xs rounded-xl gap-1" onClick={async () => {
                          setHistoryAccountId(acc.id);
                          setHistoryLoading(true);
                          const { data } = await supabase.from('cash_counts').select('*').eq('account_id', acc.id).order('counted_at', { ascending: false }).limit(20);
                          setHistoryData(data || []);
                          setHistoryLoading(false);
                        }}>
                          <History className="w-3.5 h-3.5" />
                          {(t as any).cashCountHistory}
                        </Button>
                      </div>
                      {cashCounts[acc.id] && (
                        <p className="text-[10px] text-muted-foreground text-center">
                          {(t as any).lastCount}: {new Date(cashCounts[acc.id].counted_at).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US')} — {fmt(cashCounts[acc.id].total_counted)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" className="w-full text-xs rounded-xl" onClick={() => { setUpdateBalanceDialog(acc); setNewRealBalance(String(acc.real_balance)); }}>
                      {t.updateRealBalance}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Account Dialog */}
      <ResponsiveFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? t.edit : t.addAccount}
        description={t.configureAccount}
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">{t.cancel}</Button>
            <Button className="text-primary-foreground rounded-xl min-w-[120px]" style={{ background: 'var(--gradient-primary)' }} onClick={handleSave} disabled={saving}>
              {saving ? t.saving : t.save}
            </Button>
          </>
        }
      >
          <div className="space-y-4 py-2 form-animate">
            {/* Account name */}
            <div className="space-y-1.5">
              <Label className="form-label">{t.accountName}</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} maxLength={100} placeholder={t.accountNamePlaceholder} className={`rounded-xl h-11 ${errors.name ? 'border-destructive' : ''}`} />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            {/* Type */}
            <div className="space-y-2">
              <Label className="form-label">{t.type}</Label>
              <div className="grid grid-cols-3 gap-2">
                {getAccountTypes(t).slice(0, 3).map(at => (
                  <button key={at.value} type="button" onClick={() => setForm(f => ({ ...f, type: at.value }))}
                    className={`flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${form.type === at.value ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:bg-muted/50'}`}>
                    <span className="text-lg">{at.icon}</span>
                    {at.label.split(' ').slice(1).join(' ')}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {getAccountTypes(t).slice(3).map(at => (
                  <button key={at.value} type="button" onClick={() => setForm(f => ({ ...f, type: at.value }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-all ${form.type === at.value ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card text-muted-foreground hover:bg-muted/50'}`}>
                    <span className="text-lg">{at.icon}</span>
                    {at.label.split(' ').slice(1).join(' ')}
                  </button>
                ))}
              </div>
            </div>
            {/* Icon */}
            <div className="space-y-2">
              <Label className="form-label">{t.iconLabel}</Label>
              <div className="flex flex-wrap gap-2">
                {ICONS.map(ic => (
                  <button key={ic} type="button" onClick={() => setForm(f => ({ ...f, icon: ic }))}
                    className={`text-xl p-2 rounded-xl border-2 transition-all ${form.icon === ic ? 'border-primary bg-primary/10 scale-110' : 'border-border hover:bg-muted/50'}`}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            {/* Opening balance */}
            <div className="space-y-2">
              <Label className="form-label">{t.openingBalance}</Label>
              <Input type="number" step="0.01" value={form.opening_balance} onChange={e => setForm(f => ({ ...f, opening_balance: e.target.value }))} className={`rounded-xl h-11 text-lg font-bold ${errors.opening_balance ? 'border-destructive' : ''}`} />
              {errors.opening_balance && <p className="text-xs text-destructive">{errors.opening_balance}</p>}
            </div>
          </div>
      </ResponsiveFormDialog>

      {/* Update balance dialog */}
      <Dialog open={!!updateBalanceDialog} onOpenChange={() => setUpdateBalanceDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{t.updateRealBalance}</DialogTitle>
            <DialogDescription>{t.updateBalanceDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="form-label">{t.realBalance}</Label>
            <Input type="number" step="0.01" value={newRealBalance} onChange={e => setNewRealBalance(e.target.value)} className="rounded-xl h-11 text-lg font-bold" />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setUpdateBalanceDialog(null)} className="rounded-xl">{t.cancel}</Button>
            <Button className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={handleUpdateRealBalance}>{t.save}</Button>
          </DialogFooter>
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

      {user && (
        <TransferDialog
          open={transferOpen}
          onOpenChange={setTransferOpen}
          accounts={accounts}
          userId={user.id}
          t={t}
          onSuccess={refreshAll}
        />
      )}
      <ConfirmDeleteDialog open={bulkDeleteOpen} onOpenChange={() => setBulkDeleteOpen(false)} onConfirm={handleBulkDelete} title={t.deleteSelection} description={t.bulkDeleteConfirm(bulk.count)} cancelLabel={t.cancel} confirmLabel={t.delete} />

      {user && (
        <CashCountDialog
          open={!!cashCountAccount}
          onOpenChange={v => { if (!v) setCashCountAccount(null); }}
          account={cashCountAccount}
          theoreticalBalance={cashCountAccount ? getTheoreticalBalance(cashCountAccount.id) : 0}
          userId={user.id}
          currency={currency}
          locale={locale}
          fmt={fmt}
          t={t}
          onSuccess={refreshAll}
        />
      )}

      {/* Cash Count History Sheet */}
      <Sheet open={!!historyAccountId} onOpenChange={v => { if (!v) { setHistoryAccountId(null); setPreviewCashCount(null); } }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              {(t as any).cashCountHistory}
            </SheetTitle>
            <SheetDescription>
              {accounts.find(a => a.id === historyAccountId)?.icon} {accounts.find(a => a.id === historyAccountId)?.name}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            {historyLoading ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
            ) : historyData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{(t as any).noCashCounts}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.date}</TableHead>
                    <TableHead className="text-right">{t.counted}</TableHead>
                    <TableHead className="text-right">{t.discrepancy}</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyData.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm">{new Date(c.counted_at).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US')}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{fmt(Number(c.total_counted))}</TableCell>
                      <TableCell className={`text-right text-sm font-bold ${Number(c.discrepancy) === 0 ? 'text-secondary' : 'text-destructive'}`}>
                        {Number(c.discrepancy) >= 0 ? '+' : ''}{fmt(Number(c.discrepancy))}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setPreviewCashCount(c)}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Cash Count Preview Dialog */}
      <Dialog open={!!previewCashCount} onOpenChange={v => { if (!v) setPreviewCashCount(null); }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-accent" />
              {locale === 'fr' ? 'Procès-Verbal d\'Espèces' : 'Cash Count Report'}
            </DialogTitle>
            <DialogDescription>
              {accounts.find(a => a.id === historyAccountId)?.icon} {accounts.find(a => a.id === historyAccountId)?.name}
              {' — '}
              {previewCashCount && new Date(previewCashCount.counted_at).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </DialogDescription>
          </DialogHeader>

          {previewCashCount && (() => {
            const denoms = typeof previewCashCount.denominations === 'string'
              ? JSON.parse(previewCashCount.denominations)
              : previewCashCount.denominations;
            const entries = Object.entries(denoms || {})
              .map(([d, q]) => ({ denomination: Number(d), quantity: Number(q) }))
              .filter(e => e.quantity > 0)
              .sort((a, b) => b.denomination - a.denomination);
            const disc = Number(previewCashCount.discrepancy);

            return (
              <div id="cash-count-preview" className="space-y-4">
                {/* Denominations table */}
                {entries.length > 0 && (
                  <div className="rounded-xl border border-border/50 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="text-xs">{locale === 'fr' ? 'Coupure' : 'Denomination'}</TableHead>
                          <TableHead className="text-xs text-center">{locale === 'fr' ? 'Quantité' : 'Quantity'}</TableHead>
                          <TableHead className="text-xs text-right">{locale === 'fr' ? 'Sous-total' : 'Subtotal'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entries.map(e => (
                          <TableRow key={e.denomination}>
                            <TableCell className="text-sm font-medium">{fmt(e.denomination)}</TableCell>
                            <TableCell className="text-sm text-center">{e.quantity}</TableCell>
                            <TableCell className="text-sm text-right font-semibold">{fmt(e.denomination * e.quantity)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-muted/40 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.counted}</p>
                    <p className="text-base font-bold">{fmt(Number(previewCashCount.total_counted))}</p>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.expected}</p>
                    <p className="text-base font-bold">{fmt(Number(previewCashCount.expected_balance))}</p>
                  </div>
                  <div className={`rounded-xl p-3 col-span-2 ${Math.abs(disc) > 0.01 ? 'bg-destructive/5 border border-destructive/10' : 'bg-secondary/5 border border-secondary/10'}`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.discrepancy}</p>
                    <p className={`text-lg font-bold ${Math.abs(disc) > 0.01 ? 'text-destructive' : 'text-secondary'}`}>
                      {disc >= 0 ? '+' : ''}{fmt(disc)}
                    </p>
                  </div>
                </div>

                {/* Notes */}
                {previewCashCount.notes && (
                  <div className="rounded-xl bg-muted/30 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.notes}</p>
                    <p className="text-sm">{previewCashCount.notes}</p>
                  </div>
                )}
              </div>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setPreviewCashCount(null)}>{t.cancel}</Button>
            <Button
              className="rounded-xl gap-1.5"
              style={{ background: 'var(--gradient-primary)' }}
              onClick={() => {
                const el = document.getElementById('cash-count-preview');
                if (!el) return;
                const acc = accounts.find(a => a.id === historyAccountId);
                const date = previewCashCount ? new Date(previewCashCount.counted_at).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US') : '';
                const printWin = window.open('', '_blank', 'width=600,height=800');
                if (!printWin) return;
                printWin.document.write(`<!DOCTYPE html><html><head><title>PV Espèces - ${acc?.name || ''} - ${date}</title>
                  <style>
                    body { font-family: system-ui, sans-serif; padding: 32px; max-width: 500px; margin: 0 auto; color: #111; }
                    h1 { font-size: 18px; margin-bottom: 4px; }
                    h2 { font-size: 13px; color: #666; font-weight: normal; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
                    th, td { padding: 6px 10px; border: 1px solid #ddd; font-size: 13px; }
                    th { background: #f5f5f5; text-align: left; font-weight: 600; text-transform: uppercase; font-size: 11px; }
                    td.num { text-align: right; }
                    td.center { text-align: center; }
                    .summary { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
                    .summary-item { padding: 10px; border: 1px solid #ddd; border-radius: 8px; }
                    .summary-item.full { grid-column: span 2; }
                    .summary-label { font-size: 10px; text-transform: uppercase; color: #666; font-weight: 700; }
                    .summary-value { font-size: 16px; font-weight: 700; margin-top: 2px; }
                    .positive { color: #16a34a; }
                    .negative { color: #dc2626; }
                    .notes { padding: 10px; background: #f9f9f9; border-radius: 8px; margin-top: 12px; }
                    .notes-label { font-size: 10px; text-transform: uppercase; color: #666; font-weight: 700; }
                    @media print { body { padding: 16px; } }
                  </style></head><body>
                  <h1>📝 ${locale === 'fr' ? 'Procès-Verbal d\'Espèces' : 'Cash Count Report'}</h1>
                  <h2>${acc?.icon || ''} ${acc?.name || ''} — ${date}</h2>
                  ${el.innerHTML}
                  </body></html>`);
                printWin.document.close();
                setTimeout(() => { printWin.print(); }, 300);
              }}
            >
              <Printer className="w-3.5 h-3.5" />
              {locale === 'fr' ? 'Imprimer' : 'Print'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AccountsPage;
