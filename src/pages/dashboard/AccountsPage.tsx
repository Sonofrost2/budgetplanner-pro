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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Wallet, TrendingUp, TrendingDown, AlertTriangle, Inbox, ArrowLeftRight } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDeleteDialog from '@/components/dashboard/ConfirmDeleteDialog';
import UpgradeBanner from '@/components/dashboard/UpgradeBanner';
import { TransferDialog } from '@/components/dashboard/TransferDialog';

const getAccountTypes = (t: any) => [
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
  const { fmt: fmtCurrency } = useProfile();
  const { limits, isPremium } = useSubscription();
  const t = dashT[locale];
  const [searchParams, setSearchParams] = useSearchParams();
  const typeFilter = searchParams.get('type') || '';
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [updateBalanceDialog, setUpdateBalanceDialog] = useState<any>(null);
  const [newRealBalance, setNewRealBalance] = useState('');
  const [form, setForm] = useState({ name: '', type: 'mobile_money', icon: '💳', opening_balance: '0' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);

  const filteredAccounts = useMemo(() => {
    if (!typeFilter) return accounts;
    return accounts.filter(a => a.type === typeFilter);
  }, [accounts, typeFilter]);

  const fmt = (n: number) => fmtCurrency(n, locale);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [accRes, txRes] = await Promise.all([
      supabase.from('payment_accounts').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('transactions').select('type, amount, account_id').eq('user_id', user.id).limit(10000),
    ]);
    setAccounts(accRes.data || []);
    setTransactions(txRes.data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getTheoreticalBalance = (accountId: string) => {
    const txs = transactions.filter(tx => tx.account_id === accountId);
    const income = txs.filter(tx => tx.type === 'income').reduce((s, tx) => s + Number(tx.amount), 0);
    const expense = txs.filter(tx => tx.type === 'expense').reduce((s, tx) => s + Number(tx.amount), 0);
    return income - expense;
  };

  const accountLimitReached = !isPremium && accounts.length >= limits.accounts;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = t.nameRequired;
    if (form.name.trim().length > 100) errs.name = t.maxChars(100);
    if (Number(form.opening_balance) < 0) errs.opening_balance = t.invalidBalance;
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
      // Inject opening balance as an income transaction for consistency
      if (openingBal > 0 && newAcc) {
        await supabase.from('transactions').insert({
          user_id: user.id,
          type: 'income',
          amount: openingBal,
          description: `${t.openingBalance} – ${form.name.trim()}`,
          account_id: newAcc.id,
          date: new Date().toISOString().split('T')[0],
        });
      }
    }
    setSaving(false);
    setDialogOpen(false);
    fetchData();
    toast.success(t.saved);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('payment_accounts').delete().eq('id', deleteId);
    setDeleteId(null);
    fetchData();
    toast.success(t.delete + ' ✓');
  };

  const handleUpdateRealBalance = async () => {
    if (!updateBalanceDialog) return;
    const { error } = await supabase.from('payment_accounts').update({ real_balance: Number(newRealBalance) }).eq('id', updateBalanceDialog.id);
    if (error) { toast.error(error.message); return; }
    setUpdateBalanceDialog(null);
    fetchData();
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
      {accountLimitReached && (
        <UpgradeBanner message={t.limitAccountsReached(limits.accounts)} />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold font-display">{t.accounts}</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setTransferOpen(true)} disabled={accounts.length < 2}>
            <ArrowLeftRight className="w-4 h-4 mr-1" />{(t as any).makeTransfer}
          </Button>
          <Button size="sm" className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={openNew} disabled={accountLimitReached}>
            <Plus className="w-4 h-4 mr-1" />{t.addAccount}
          </Button>
        </div>
      </div>

      {accounts.length === 0 ? (
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
          {accounts.map(acc => {
            const theoretical = getTheoreticalBalance(acc.id);
            const real = Number(acc.real_balance);
            const discrepancy = real - theoretical;
            return (
              <Card key={acc.id} className={`border border-border/50 shadow-[var(--shadow-card)] rounded-2xl hover:shadow-[var(--shadow-soft)] transition-shadow ${Math.abs(discrepancy) > 0.01 ? 'ring-1 ring-destructive/20' : ''}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2.5">
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
                  <Button variant="outline" size="sm" className="w-full text-xs rounded-xl" onClick={() => { setUpdateBalanceDialog(acc); setNewRealBalance(String(acc.real_balance)); }}>
                    {t.updateRealBalance}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Account Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{editing ? t.edit : t.addAccount}</DialogTitle>
            <DialogDescription>{t.configureAccount}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Account name */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.accountName}</Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                maxLength={100}
                placeholder={t.accountNamePlaceholder}
                className={`rounded-xl h-11 ${errors.name ? 'border-destructive' : ''}`}
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.type}</Label>
               <div className="grid grid-cols-3 gap-2">
                 {getAccountTypes(t).slice(0, 3).map(at => (
                  <button
                    key={at.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, type: at.value }))}
                    className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                      form.type === at.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                    }`}
                  >
                    <span className="text-xl">{at.icon}</span>
                    {at.label.split(' ').slice(1).join(' ')}
                  </button>
                ))}
              </div>
               <div className="grid grid-cols-2 gap-2">
                 {getAccountTypes(t).slice(3).map(at => (
                  <button
                    key={at.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, type: at.value }))}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${
                      form.type === at.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                    }`}
                  >
                    <span className="text-lg">{at.icon}</span>
                    {at.label.split(' ').slice(1).join(' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Icon */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.iconLabel}</Label>
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
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.openingBalance}</Label>
              <Input
                type="number"
                step="0.01"
                value={form.opening_balance}
                onChange={e => setForm(f => ({ ...f, opening_balance: e.target.value }))}
                className={`rounded-xl h-11 text-lg font-bold ${errors.opening_balance ? 'border-destructive' : ''}`}
              />
              {errors.opening_balance && <p className="text-xs text-destructive">{errors.opening_balance}</p>}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">{t.cancel}</Button>
            <Button className="text-primary-foreground rounded-xl min-w-[120px]" style={{ background: 'var(--gradient-primary)' }} onClick={handleSave} disabled={saving}>
              {saving ? t.saving : t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update balance dialog */}
      <Dialog open={!!updateBalanceDialog} onOpenChange={() => setUpdateBalanceDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{t.updateRealBalance}</DialogTitle>
            <DialogDescription>{t.updateBalanceDesc}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.realBalance}</Label>
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
          onSuccess={fetchData}
        />
      )}
    </div>
  );
};

export default AccountsPage;
