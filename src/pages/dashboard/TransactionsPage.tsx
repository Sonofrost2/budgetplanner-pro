import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { useSubscription } from '@/hooks/useSubscription';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Search, ChevronLeft, ChevronRight, Inbox, TrendingUp, TrendingDown, Calendar, FileText, CreditCard, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDeleteDialog from '@/components/dashboard/ConfirmDeleteDialog';
import UpgradeBanner from '@/components/dashboard/UpgradeBanner';
import { useSearchParams } from 'react-router-dom';

const PAGE_SIZE = 20;

const TransactionsPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const { limits, isPremium } = useSubscription();
  const t = dashT[locale];
  const [searchParams] = useSearchParams();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ description: '', amount: '', type: 'expense', category_id: '', account_id: '', date: new Date().toISOString().split('T')[0], notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fmt = (n: number) => fmtCurrency(n, locale);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [txRes, catRes, accRes] = await Promise.all([
      supabase.from('transactions').select('*, categories(name, icon, color), payment_accounts(name, icon)').eq('user_id', user.id).order('date', { ascending: false }),
      supabase.from('categories').select('*').eq('user_id', user.id),
      supabase.from('payment_accounts').select('*').eq('user_id', user.id),
    ]);
    setTransactions(txRes.data || []);
    setCategories(catRes.data || []);
    setAccounts(accRes.data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      if (filterType !== 'all' && tx.type !== filterType) return false;
      if (filterCategory !== 'all' && tx.category_id !== filterCategory) return false;
      if (filterAccount !== 'all' && tx.account_id !== filterAccount) return false;
      if (searchQuery && !tx.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (startDate && tx.date < startDate) return false;
      if (endDate && tx.date > endDate) return false;
      return true;
    });
  }, [transactions, filterType, filterCategory, filterAccount, searchQuery, startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => { setPage(0); }, [filterType, filterCategory, filterAccount, searchQuery, startDate, endDate]);

  const thisMonthCount = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    return transactions.filter(tx => tx.date >= start).length;
  }, [transactions]);

  const limitReached = !isPremium && thisMonthCount >= limits.transactionsPerMonth;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.description.trim()) errs.description = t.descriptionRequired;
    if (form.description.trim().length > 200) errs.description = t.maxChars(200);
    if (!form.amount || Number(form.amount) <= 0) errs.amount = t.invalidAmount;
    if (Number(form.amount) > 999999999) errs.amount = t.amountTooHigh;
    if (!form.date) errs.date = t.dateRequired;
    if (form.notes && form.notes.length > 500) errs.notes = t.maxChars(500);
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const openNew = () => {
    if (limitReached) {
      toast.error(t.limitTransactionsToast(limits.transactionsPerMonth));
      return;
    }
    setEditing(null);
    setErrors({});
    setForm({ description: '', amount: '', type: 'expense', category_id: categories[0]?.id || '', account_id: accounts[0]?.id || '', date: new Date().toISOString().split('T')[0], notes: '' });
    setDialogOpen(true);
  };

  const openEdit = (tx: any) => {
    setEditing(tx);
    setErrors({});
    setForm({ description: tx.description, amount: String(tx.amount), type: tx.type, category_id: tx.category_id || '', account_id: tx.account_id || '', date: tx.date, notes: tx.notes || '' });
    setDialogOpen(true);
  };

  // Helper to update account real_balance after transaction changes
  const updateAccountBalance = async (accountId: string | null) => {
    if (!accountId || !user) return;
    // Recalculate: opening_balance + sum(income) - sum(expense) for this account
    const [accRes, txRes] = await Promise.all([
      supabase.from('payment_accounts').select('opening_balance').eq('id', accountId).single(),
      supabase.from('transactions').select('type, amount').eq('user_id', user.id).eq('account_id', accountId),
    ]);
    if (accRes.error || txRes.error) return;
    const opening = Number(accRes.data.opening_balance) || 0;
    const income = (txRes.data || []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const expense = (txRes.data || []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
    await supabase.from('payment_accounts').update({ real_balance: opening + income - expense }).eq('id', accountId);
  };

  const handleSave = async () => {
    if (!user || !validate()) return;
    setSaving(true);
    const payload = {
      user_id: user.id, description: form.description.trim(), amount: Number(form.amount),
      type: form.type, category_id: form.category_id || null, account_id: form.account_id || null,
      date: form.date, notes: form.notes.trim() || null,
    };
    if (editing) {
      const { error } = await supabase.from('transactions').update(payload).eq('id', editing.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      // Update old and new account balances if account changed
      const affectedAccounts = new Set([editing.account_id, payload.account_id].filter(Boolean));
      for (const accId of affectedAccounts) await updateAccountBalance(accId);
    } else {
      const { error } = await supabase.from('transactions').insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
      await updateAccountBalance(payload.account_id);
    }
    setSaving(false);
    setDialogOpen(false);
    fetchData();
    toast.success(t.saved);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    // Get the transaction to know its account before deleting
    const txToDelete = transactions.find(tx => tx.id === deleteId);
    const { error } = await supabase.from('transactions').delete().eq('id', deleteId);
    if (error) { toast.error(error.message); setDeleteId(null); return; }
    if (txToDelete?.account_id) await updateAccountBalance(txToDelete.account_id);
    setDeleteId(null);
    fetchData();
    toast.success(t.delete + ' ✓');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="flex gap-3"><Skeleton className="h-10 w-40" /><Skeleton className="h-10 w-48" /></div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const filteredCategories = categories.filter(c => c.type === form.type);

  return (
    <div className="space-y-6">
      {limitReached && (
        <UpgradeBanner message={t.limitReachedTransactions(thisMonthCount, limits.transactionsPerMonth)} />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold font-display">{t.allTransactions}
          {!isPremium && <span className="text-sm font-normal text-muted-foreground ml-2">({thisMonthCount}/{limits.transactionsPerMonth})</span>}
        </h2>
        <Button size="sm" className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={openNew} disabled={limitReached}>
          <Plus className="w-4 h-4 mr-1" />{t.addTransaction}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t.search + '...'} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 rounded-xl" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.all}</SelectItem>
            <SelectItem value="income">{t.incomeType}</SelectItem>
            <SelectItem value="expense">{t.expenseType}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-44 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.all} {t.category}</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterAccount} onValueChange={setFilterAccount}>
          <SelectTrigger className="w-44 rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.allAccounts}</SelectItem>
            {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-40 rounded-xl" />
        <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-40 rounded-xl" />
      </div>

      {/* Transactions list */}
      <Card className="border border-border/50 shadow-[var(--shadow-card)] rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center">
                <Inbox className="w-7 h-7 text-muted-foreground/40" />
              </div>
              {transactions.length === 0 ? (
                <>
                  <p className="text-lg font-semibold text-muted-foreground mb-2">{t.noTransactions}</p>
                  <p className="text-sm text-muted-foreground/70 mb-4">{t.addFirstTransaction}</p>
                  <Button size="sm" className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={openNew}>
                    <Plus className="w-4 h-4 mr-1" />{t.addTransaction}
                  </Button>
                </>
              ) : (
                 <p className="text-lg font-semibold text-muted-foreground">{t.noResults}</p>
              )}
            </div>
          ) : (
            <>
              <div className="divide-y divide-border/50">
                {paginated.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center text-lg flex-shrink-0">
                        {tx.categories?.icon || '📁'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{tx.description}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {tx.categories?.name || '-'} · {tx.payment_accounts?.icon} {tx.payment_accounts?.name || '-'} · {new Date(tx.date).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-sm font-bold ${tx.type === 'income' ? 'text-secondary' : 'text-destructive'}`}>
                        {tx.type === 'income' ? '+' : '-'}{fmt(Number(tx.amount))}
                      </span>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => openEdit(tx)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive" onClick={() => setDeleteId(tx.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between px-5 py-3.5 border-t border-border/50 bg-muted/20">
                <span className="text-xs text-muted-foreground">
                  {filtered.length} {t.results} — {t.page} {page + 1}/{totalPages}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="rounded-xl h-8" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" />{t.previous}
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-xl h-8" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                    {t.next}<ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog — improved */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{editing ? t.edit : t.addTransaction}</DialogTitle>
             <DialogDescription className="text-sm text-muted-foreground">
               {t.fillTransactionDetails}
             </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Type toggle */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.type}</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, type: 'expense', category_id: '' }))}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                    form.type === 'expense'
                      ? 'border-destructive bg-destructive/10 text-destructive'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <TrendingDown className="w-4 h-4" />
                  {t.expenseType}
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, type: 'income', category_id: '' }))}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                    form.type === 'income'
                      ? 'border-secondary bg-secondary/10 text-secondary'
                      : 'border-border bg-card text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  {t.incomeType}
                </button>
              </div>
            </div>

            {/* Amount + Date row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  {t.amount}
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    className={`rounded-xl h-11 text-lg font-bold pl-4 ${errors.amount ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                    placeholder="0"
                  />
                </div>
                {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" />
                  {t.date}
                </Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className={`rounded-xl h-11 ${errors.date ? 'border-destructive' : ''}`}
                />
                {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileText className="w-3 h-3" />
                {t.description}
              </Label>
              <Input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                maxLength={200}
                placeholder={locale === 'fr' ? 'Ex: Courses supermarché' : 'E.g: Grocery shopping'}
                className={`rounded-xl h-11 ${errors.description ? 'border-destructive' : ''}`}
              />
              {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
            </div>

            {/* Category + Account row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Tag className="w-3 h-3" />
                  {t.category}
                </Label>
                <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v }))}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder={locale === 'fr' ? 'Choisir...' : 'Select...'} /></SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <CreditCard className="w-3 h-3" />
                  {t.account}
                </Label>
                <Select value={form.account_id} onValueChange={v => setForm(f => ({ ...f, account_id: v }))}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue placeholder={locale === 'fr' ? 'Choisir...' : 'Select...'} /></SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t.notes} <span className="text-muted-foreground/50 font-normal normal-case">({locale === 'fr' ? 'optionnel' : 'optional'})</span>
              </Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                maxLength={500}
                rows={2}
                className={`rounded-xl resize-none ${errors.notes ? 'border-destructive' : ''}`}
                placeholder={locale === 'fr' ? 'Ajoutez une note...' : 'Add a note...'}
              />
              {errors.notes && <p className="text-xs text-destructive">{errors.notes}</p>}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">{t.cancel}</Button>
            <Button
              className="text-primary-foreground rounded-xl min-w-[120px]"
              style={{ background: 'var(--gradient-primary)' }}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (locale === 'fr' ? 'Enregistrement...' : 'Saving...') : t.save}
            </Button>
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

export default TransactionsPage;
