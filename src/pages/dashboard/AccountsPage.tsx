import { useEffect, useState, useCallback } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Wallet, TrendingUp, TrendingDown, AlertTriangle, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDeleteDialog from '@/components/dashboard/ConfirmDeleteDialog';
import UpgradeBanner from '@/components/dashboard/UpgradeBanner';

const ACCOUNT_TYPES = [
  { value: 'mobile_money', label: '📱 Mobile Money' },
  { value: 'bank', label: '🏦 Banque' },
  { value: 'cash', label: '💵 Espèces' },
  { value: 'card', label: '💳 Carte' },
  { value: 'savings', label: '🏦 Épargne' },
];

const ICONS = ['💳', '📱', '🏦', '💵', '🌊', '🟠', '🟡', '🔵', '💰', '🏧'];

const AccountsPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const t = dashT[locale];
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [updateBalanceDialog, setUpdateBalanceDialog] = useState<any>(null);
  const [newRealBalance, setNewRealBalance] = useState('');
  const [form, setForm] = useState({ name: '', type: 'mobile_money', icon: '💳', opening_balance: '0' });
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fmt = (n: number) => fmtCurrency(n, locale);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [accRes, txRes] = await Promise.all([
      supabase.from('payment_accounts').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('transactions').select('type, amount, account_id').eq('user_id', user.id),
    ]);
    setAccounts(accRes.data || []);
    setTransactions(txRes.data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getTheoreticalBalance = (accountId: string, openingBalance: number) => {
    const txs = transactions.filter(tx => tx.account_id === accountId);
    const income = txs.filter(tx => tx.type === 'income').reduce((s, tx) => s + Number(tx.amount), 0);
    const expense = txs.filter(tx => tx.type === 'expense').reduce((s, tx) => s + Number(tx.amount), 0);
    return openingBalance + income - expense;
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', type: 'mobile_money', icon: '💳', opening_balance: '0' });
    setDialogOpen(true);
  };

  const openEdit = (acc: any) => {
    setEditing(acc);
    setForm({ name: acc.name, type: acc.type, icon: acc.icon, opening_balance: String(acc.opening_balance) });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !form.name.trim()) return;
    const payload = {
      user_id: user.id, name: form.name.trim(), type: form.type, icon: form.icon,
      opening_balance: Number(form.opening_balance) || 0,
      real_balance: editing ? undefined : Number(form.opening_balance) || 0,
    };
    if (editing) {
      const { real_balance, ...updatePayload } = payload;
      const { error } = await supabase.from('payment_accounts').update(updatePayload).eq('id', editing.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from('payment_accounts').insert(payload);
      if (error) { toast.error(error.message); return; }
    }
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
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold font-display">{t.accounts}</h2>
        <Button size="sm" className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }} onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" />{t.addAccount}
        </Button>
      </div>

      {accounts.length === 0 ? (
        <Card className="border-none shadow-[var(--shadow-card)]">
          <CardContent className="py-16 text-center">
            <Wallet className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-lg font-medium text-muted-foreground mb-2">{t.noAccounts}</p>
            <Button size="sm" className="text-primary-foreground mt-2" style={{ background: 'var(--gradient-primary)' }} onClick={openNew}>
              <Plus className="w-4 h-4 mr-1" />{t.addAccount}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {accounts.map(acc => {
            const theoretical = getTheoreticalBalance(acc.id, Number(acc.opening_balance));
            const real = Number(acc.real_balance);
            const discrepancy = real - theoretical;
            return (
              <Card key={acc.id} className="border-none shadow-[var(--shadow-card)]">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <span className="text-xl">{acc.icon}</span>{acc.name}
                    </CardTitle>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(acc)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(acc.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{ACCOUNT_TYPES.find(at => at.value === acc.type)?.label || acc.type}</span>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">{t.openingBalance}</p>
                      <p className="font-medium">{fmt(Number(acc.opening_balance))}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t.theoreticalBalance}</p>
                      <p className="font-medium flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-secondary" />
                        {fmt(theoretical)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t.realBalance}</p>
                      <p className="font-medium">{fmt(real)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">{t.discrepancy}</p>
                      <p className={`font-medium flex items-center gap-1 ${Math.abs(discrepancy) > 0.01 ? 'text-destructive' : 'text-secondary'}`}>
                        {Math.abs(discrepancy) > 0.01 && <AlertTriangle className="w-3 h-3" />}
                        {discrepancy >= 0 ? '+' : ''}{fmt(discrepancy)}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => { setUpdateBalanceDialog(acc); setNewRealBalance(String(acc.real_balance)); }}>
                    {t.updateRealBalance}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? t.edit : t.addAccount}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t.description}</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label>{t.type}</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map(at => <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Icône</Label>
              <div className="flex flex-wrap gap-2">
                {ICONS.map(ic => (
                  <button key={ic} onClick={() => setForm(f => ({ ...f, icon: ic }))}
                    className={`text-xl p-1.5 rounded-lg border transition-colors ${form.icon === ic ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t.openingBalance}</Label>
              <Input type="number" step="0.01" value={form.opening_balance} onChange={e => setForm(f => ({ ...f, opening_balance: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t.cancel}</Button>
            <Button className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }} onClick={handleSave}>{t.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!updateBalanceDialog} onOpenChange={() => setUpdateBalanceDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.updateRealBalance}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>{t.realBalance}</Label>
            <Input type="number" step="0.01" value={newRealBalance} onChange={e => setNewRealBalance(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdateBalanceDialog(null)}>{t.cancel}</Button>
            <Button className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }} onClick={handleUpdateRealBalance}>{t.save}</Button>
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
    </div>
  );
};

export default AccountsPage;
