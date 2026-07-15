import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { invokeAuthedEdgeFunction } from '@/lib/aiEdge';
import { useDebts, useInvalidate } from '@/hooks/useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ResponsiveFormDialog } from '@/components/ui/responsive-form-dialog';
import { InputField } from '@/components/ui/input-field';
import { Progress } from '@/components/ui/progress';
import { Plus, Landmark, Pencil, Trash2, Sparkles, Loader2, TrendingDown, Target, Lightbulb, Search, X, Download, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { showApiError } from '@/lib/apiError';
import { useAccounts } from '@/hooks/useDashboardData';
import { AccountCombobox } from '@/components/dashboard/AccountCombobox';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { PageSkeleton } from '@/components/ui/loading-state';
import { PageHeader } from '@/components/ui/page-header';
import ConfirmDeleteDialog from '@/components/dashboard/ConfirmDeleteDialog';
import BulkActionBar from '@/components/dashboard/BulkActionBar';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import ReactMarkdown from 'react-markdown';
import { exportToCSV, exportToExcel } from '@/lib/export';
import { debtSchema, validateForm } from '@/lib/validationSchemas';
import { currencySymbol, exampleAmount, amountLabel } from '@/lib/currency';

const DebtsPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency, currency } = useProfile();
  const t = dashT[locale];
  const { invalidate } = useInvalidate();

  const { data: debts = [], isLoading: loading } = useDebts();
  const { data: accounts = [] } = useAccounts();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ creditor_name: '', total_amount: '', paid_amount: '', due_date: '', notes: '', account_id: '' });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [payDialog, setPayDialog] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payAccountId, setPayAccountId] = useState('');
  const [aiPlan, setAiPlan] = useState<any>(null);
  const [aiPlanLoading, setAiPlanLoading] = useState(false);
  const [aiPlanOpen, setAiPlanOpen] = useState(false);
  const [searchQuery, setSearchQuery] = usePersistedState<string>('debts:search', '');
  const [statusFilter, setStatusFilter] = usePersistedState<'all' | 'active' | 'paid' | 'overdue'>('debts:statusFilter', 'all');
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const fmt = (n: number) => fmtCurrency(n, locale);
  const refreshData = () => invalidate('debts');

  const filteredDebts = useMemo(() => {
    let result = [...debts];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d => d.creditor_name.toLowerCase().includes(q) || d.notes?.toLowerCase().includes(q));
    }
    if (statusFilter === 'active') result = result.filter(d => Number(d.total_amount) - Number(d.paid_amount) > 0 && !(d.due_date && new Date(d.due_date) < new Date()));
    else if (statusFilter === 'paid') result = result.filter(d => Number(d.total_amount) - Number(d.paid_amount) <= 0);
    else if (statusFilter === 'overdue') result = result.filter(d => d.due_date && new Date(d.due_date) < new Date() && Number(d.total_amount) - Number(d.paid_amount) > 0);
    return result;
  }, [debts, searchQuery, statusFilter]);

  const bulk = useBulkSelection(filteredDebts);

  const handleBulkDelete = async () => {
    const ids = Array.from(bulk.selectedIds);
    const { error } = await supabase.from('debts').delete().in('id', ids);
    if (error) { showApiError(error, locale); setBulkDeleteOpen(false); return; }
    bulk.clear();
    setBulkDeleteOpen(false);
    refreshData();
    toast.success(locale === 'fr' ? 'Dettes supprimées' : 'Debts deleted');
  };

  const handleExportCSV = () => {
    const rows = filteredDebts.map(d => ({ [t.creditor]: d.creditor_name, [t.totalDebt]: d.total_amount, [t.paidAmount]: d.paid_amount, [t.remainingDebt]: Number(d.total_amount) - Number(d.paid_amount), [t.deadline]: d.due_date || '', [t.notes]: d.notes || '' }));
    if (!exportToCSV(rows, 'debts')) toast.info(locale === 'fr' ? 'Aucune dette' : 'No debts');
  };

  const handleExportExcel = () => {
    const rows = filteredDebts.map(d => ({ [t.creditor]: d.creditor_name, [t.totalDebt]: d.total_amount, [t.paidAmount]: d.paid_amount, [t.remainingDebt]: Number(d.total_amount) - Number(d.paid_amount), [t.deadline]: d.due_date || '', [t.notes]: d.notes || '' }));
    if (!exportToExcel(rows, 'debts')) toast.info(locale === 'fr' ? 'Aucune dette' : 'No debts');
  };

  const validateDebtForm = () => {
    const result = validateForm(debtSchema(locale), form);
    if (result.success === false) { setFormErrors(result.errors); return false; }
    // Cross-field: paid <= total
    if (form.paid_amount && Number(form.paid_amount) > Number(form.total_amount)) {
      setFormErrors({ paid_amount: locale === 'fr' ? 'Le montant payé ne peut pas dépasser le total' : 'Paid amount cannot exceed total' });
      return false;
    }
    setFormErrors({});
    return true;
  };

  const handleSave = async () => {
    if (!user || !validateDebtForm()) return;
    const payload = { creditor_name: form.creditor_name.trim(), total_amount: Number(form.total_amount), paid_amount: Number(form.paid_amount) || 0, due_date: form.due_date || null, notes: form.notes || null, account_id: form.account_id || null };
    const { error } = editId
      ? await supabase.from('debts').update(payload).eq('id', editId)
      : await supabase.from('debts').insert({ ...payload, user_id: user.id });
    if (error) { showApiError(error, locale); return; }
    setDialogOpen(false); setEditId(null);
    refreshData();
    toast.success(t.saved);
  };

  const handlePay = async () => {
    if (!payDialog || Number(payAmount) <= 0) return;
    const debt = debts.find(d => d.id === payDialog);
    if (!debt) return;
    const amount = Number(payAmount);
    const newPaid = Math.min(Number(debt.paid_amount) + amount, Number(debt.total_amount));
    
    // Create an expense transaction for the payment
    const accountId = payAccountId || (debt as any).account_id || null;
    const today = new Date().toISOString().split('T')[0];
    const { error: txError } = await supabase.from('transactions').insert({
      user_id: user!.id,
      type: 'expense',
      amount,
      description: `${locale === 'fr' ? 'Remboursement dette' : 'Debt payment'}: ${debt.creditor_name}`,
      account_id: accountId,
      date: today,
      notes: `🏦 ${debt.creditor_name}`,
    });
    if (txError) { toast.error(txError.message); return; }

    // Update paid_amount on the debt
    await supabase.from('debts').update({ paid_amount: newPaid }).eq('id', payDialog);
    setPayDialog(null); setPayAmount(''); setPayAccountId('');
    invalidate('paginated-transactions', 'accounts', 'chart-data', 'transactions', 'all-transactions');
    refreshData();
    toast.success(t.saved);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('debts').delete().eq('id', deleteId);
    setDeleteId(null);
    refreshData();
  };

  const handleAIPlan = async () => {
    if (!user || debts.length === 0) return;
    setAiPlanLoading(true);
    setAiPlanOpen(true);
    try {
      // Fetch monthly income/expenses
      const now = new Date();
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split('T')[0];
      const { data: txs } = await supabase.from('transactions').select('type, amount, date').eq('user_id', user.id).gte('date', threeMonthsAgo);
      
      const allTxs = txs || [];
      const monthCount = 3;
      const monthlyIncome = Math.round(allTxs.filter(tx => tx.type === 'income').reduce((s, tx) => s + Number(tx.amount), 0) / monthCount);
      const monthlyExpenses = Math.round(allTxs.filter(tx => tx.type === 'expense').reduce((s, tx) => s + Number(tx.amount), 0) / monthCount);

      const data = await invokeAuthedEdgeFunction<any>('ai-debt-plan', {
        locale,
        body: {
          debts: debts.map(d => ({
            creditor: d.creditor_name,
            total: Number(d.total_amount),
            paid: Number(d.paid_amount),
            remaining: Number(d.total_amount) - Number(d.paid_amount),
            dueDate: d.due_date,
            notes: d.notes,
            // ⚠️ Indispensable pour la méthode "avalanche" — sans le taux,
            // l'IA ne peut pas trier les dettes par coût d'intérêt réel.
            interestRatePct: Number((d as any).interest_rate) || 0,
            interestType: (d as any).interest_type || 'simple',
          })),
          monthlyIncome,
          monthlyExpenses,
          locale,
        },
      });
      setAiPlan(data);
    } catch (e: any) {
      toast.error(e.message || 'AI error');
    } finally {
      setAiPlanLoading(false);
    }
  };

  const openNew = () => { setEditId(null); setFormErrors({}); setForm({ creditor_name: '', total_amount: '', paid_amount: '', due_date: '', notes: '', account_id: '' }); setDialogOpen(true); };
  const openEdit = (d: any) => { setEditId(d.id); setFormErrors({}); setForm({ creditor_name: d.creditor_name, total_amount: String(d.total_amount), paid_amount: String(d.paid_amount), due_date: d.due_date || '', notes: d.notes || '', account_id: d.account_id || '' }); setDialogOpen(true); };

  const totalDebt = debts.reduce((s, d) => s + Number(d.total_amount), 0);
  const totalPaid = debts.reduce((s, d) => s + Number(d.paid_amount), 0);
  const totalRemaining = totalDebt - totalPaid;

  if (loading) return <PageSkeleton layout="grid" count={4} />;

  const methodLabels: Record<string, string> = {
    snowball: locale === 'fr' ? '❄️ Boule de neige' : '❄️ Snowball',
    avalanche: locale === 'fr' ? '🏔️ Avalanche' : '🏔️ Avalanche',
    hybrid: locale === 'fr' ? '🔄 Hybride' : '🔄 Hybrid',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.debts}
        icon={Landmark}
        description={debts.length > 0
          ? `${fmt(totalPaid)} / ${fmt(totalDebt)} ${locale === 'fr' ? 'remboursé' : 'repaid'} — ${locale === 'fr' ? 'Reste' : 'Remaining'}: ${fmt(totalRemaining)}`
          : (locale === 'fr' ? 'Suivez et remboursez vos dettes intelligemment.' : 'Track and pay down your debts smartly.')}
        actions={
          <>
            {debts.length > 0 && (
              <>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={handleExportCSV}><Download className="w-4 h-4 mr-1" /> CSV</Button>
                <Button size="sm" variant="outline" className="rounded-xl" onClick={handleExportExcel}><Download className="w-4 h-4 mr-1" /> Excel</Button>
              </>
            )}
            {debts.length > 0 && debts.some(d => Number(d.total_amount) - Number(d.paid_amount) > 0) && (
              <Button size="sm" variant="outline" className="rounded-xl" onClick={handleAIPlan} disabled={aiPlanLoading}>
                <Sparkles className="w-4 h-4 mr-1" />{locale === 'fr' ? 'Plan IA' : 'AI Plan'}
              </Button>
            )}
            <Button size="sm" className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={openNew}><Plus className="w-4 h-4 mr-1" />{t.addDebt}</Button>
          </>
        }
      />

      {/* Search & filters */}
      {debts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={locale === 'fr' ? 'Rechercher un créancier...' : 'Search creditor...'} className="pl-9 pr-8 rounded-xl h-10" />
            {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>}
          </div>
          <div className="flex gap-1.5">
            {(['all', 'active', 'paid', 'overdue'] as const).map(s => {
              const labels: Record<string, string> = locale === 'fr'
                ? { all: 'Tous', active: 'En cours', paid: 'Soldés', overdue: 'En retard' }
                : { all: 'All', active: 'Active', paid: 'Paid off', overdue: 'Overdue' };
              return (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border
                    ${statusFilter === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-background/60 text-muted-foreground border-border/40 hover:bg-background/80'}`}>
                  {labels[s]}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {bulk.hasSelection && (
        <BulkActionBar
          count={bulk.count}
          onDelete={() => setBulkDeleteOpen(true)}
          onExportCSV={() => {
            const rows = bulk.selectedItems.map(d => ({ [t.creditor]: d.creditor_name, [t.totalDebt]: d.total_amount, [t.paidAmount]: d.paid_amount, [t.remainingDebt]: Number(d.total_amount) - Number(d.paid_amount), [t.deadline]: d.due_date || '' }));
            exportToCSV(rows, 'debts-selected');
          }}
          onClear={bulk.clear}
        />
      )}

      {filteredDebts.length === 0 && debts.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title={locale === 'fr' ? 'Aucune dette enregistrée' : 'No debts recorded'}
          description={locale === 'fr'
            ? 'Ajoutez vos crédits, emprunts ou dettes personnelles pour suivre les échéances et un plan de remboursement.'
            : 'Add your loans, credits or personal debts to track deadlines and a repayment plan.'}
          action={
            <Button size="sm" className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={openNew}>
              <Plus className="w-4 h-4 mr-1" />{t.addDebt}
            </Button>
          }
        />
      ) : filteredDebts.length === 0 ? (
        <EmptyState
          icon={Search}
          variant="compact"
          title={t.noResults}
          description={locale === 'fr' ? 'Ajustez la recherche ou les filtres pour retrouver une dette.' : 'Adjust search or filters to find a debt.'}
          action={
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}>
              {locale === 'fr' ? 'Réinitialiser les filtres' : 'Reset filters'}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDebts.map(d => {
            const total = Number(d.total_amount); const paid = Number(d.paid_amount); const remaining = total - paid;
            const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
            const isOverdue = d.due_date && new Date(d.due_date) < new Date() && remaining > 0;
            return (
              <Card key={d.id} className={`border border-border/50 shadow-[var(--shadow-card)] rounded-2xl ${isOverdue ? 'ring-1 ring-destructive/20' : ''} ${bulk.selectedIds.has(d.id) ? 'ring-2 ring-primary' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-bold flex items-center gap-2.5">
                      <Checkbox checked={bulk.selectedIds.has(d.id)} onCheckedChange={() => bulk.toggle(d.id)} className="mr-1" />
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><Landmark className="w-5 h-5 text-primary" /></div>
                      <div><span>{d.creditor_name}</span>{d.due_date && <p className={`text-[11px] font-normal ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>{locale === 'fr' ? 'Échéance' : 'Due'}: {new Date(d.due_date).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US')}</p>}</div>
                    </CardTitle>
                    <div className="flex gap-1">
                      <Button aria-label="Modifier" variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary" onClick={() => openEdit(d)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button aria-label="Supprimer" variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(d.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-baseline"><span className="text-2xl font-extrabold">{fmt(paid)}</span><span className="text-sm text-muted-foreground">/ {fmt(total)}</span></div>
                  <Progress value={pct} className={`h-3 rounded-full ${pct >= 100 ? '[&>div]:bg-secondary' : '[&>div]:bg-primary'}`} />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{t.remainingDebt}: <span className="font-semibold text-foreground">{fmt(remaining)}</span></p>
                    {remaining > 0 && <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg" onClick={() => { setPayDialog(d.id); setPayAmount(''); }}>{locale === 'fr' ? 'Rembourser' : 'Pay'}</Button>}
                    {remaining <= 0 && <span className="text-xs font-bold text-secondary">✓ {locale === 'fr' ? 'Soldé' : 'Paid off'}</span>}
                  </div>
                  {d.notes && <p className="text-xs text-muted-foreground">{d.notes}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* AI Debt Plan Dialog */}
      <Dialog open={aiPlanOpen} onOpenChange={setAiPlanOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {locale === 'fr' ? 'Plan de remboursement IA' : 'AI Repayment Plan'}
            </DialogTitle>
            <DialogDescription>
              {locale === 'fr' ? 'Analyse et recommandations personnalisées' : 'Personalized analysis and recommendations'}
            </DialogDescription>
          </DialogHeader>
          {aiPlanLoading ? (
            <div className="flex flex-col items-center py-12 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{locale === 'fr' ? 'Analyse en cours...' : 'Analyzing...'}</p>
            </div>
          ) : aiPlan && !aiPlan.error ? (
            <div className="space-y-5">
              {/* Summary */}
              <div className="bg-muted/30 rounded-xl p-4">
                <p className="text-sm">{aiPlan.summary}</p>
              </div>

              {/* Key metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-primary/10 rounded-xl p-3 text-center">
                  <Target className="w-5 h-5 text-primary mx-auto mb-1" />
                  <p className="text-lg font-bold">{methodLabels[aiPlan.recommended_method] || aiPlan.recommended_method}</p>
                  <p className="text-[11px] text-muted-foreground">{locale === 'fr' ? 'Méthode recommandée' : 'Recommended method'}</p>
                </div>
                <div className="bg-secondary/10 rounded-xl p-3 text-center">
                  <TrendingDown className="w-5 h-5 text-secondary mx-auto mb-1" />
                  <p className="text-lg font-bold">{fmt(aiPlan.monthly_payment)}</p>
                  <p className="text-[11px] text-muted-foreground">{locale === 'fr' ? 'Paiement mensuel' : 'Monthly payment'}</p>
                </div>
                <div className="bg-accent/20 rounded-xl p-3 text-center">
                  <Landmark className="w-5 h-5 text-accent-foreground mx-auto mb-1" />
                  <p className="text-lg font-bold">{aiPlan.total_months} {locale === 'fr' ? 'mois' : 'months'}</p>
                  <p className="text-[11px] text-muted-foreground">{locale === 'fr' ? 'Fin estimée' : 'Est. completion'}: {aiPlan.estimated_completion}</p>
                </div>
              </div>

              {/* Priority order */}
              {aiPlan.priority_order && aiPlan.priority_order.length > 0 && (
                <div>
                  <h4 className="font-bold text-sm mb-2">{locale === 'fr' ? 'Ordre de priorité' : 'Priority Order'}</h4>
                  <div className="space-y-2">
                    {aiPlan.priority_order.map((item: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/20 border border-border/30">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{item.priority}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{item.creditor}</p>
                          <p className="text-xs text-muted-foreground">{locale === 'fr' ? 'Reste' : 'Remaining'}: {fmt(item.remaining)} — {item.months_to_payoff} {locale === 'fr' ? 'mois' : 'months'}</p>
                        </div>
                        <p className="text-sm font-bold text-primary">{fmt(item.monthly_payment)}/{locale === 'fr' ? 'mois' : 'mo'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tips */}
              {aiPlan.tips && aiPlan.tips.length > 0 && (
                <div>
                  <h4 className="font-bold text-sm mb-2 flex items-center gap-1.5"><Lightbulb className="w-4 h-4 text-yellow-500" />{locale === 'fr' ? 'Conseils pratiques' : 'Practical Tips'}</h4>
                  <ul className="space-y-1.5">
                    {aiPlan.tips.map((tip: string, i: number) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : aiPlan?.error ? (
            <p className="text-center text-destructive py-8">{aiPlan.error}</p>
          ) : null}
        </DialogContent>
      </Dialog>

      <ResponsiveFormDialog
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditId(null); }}
        title={editId ? t.edit : t.addDebt}
        description={locale === 'fr' ? 'Enregistrez une dette à suivre' : 'Record a debt to track'}
        footer={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">{t.cancel}</Button>
            <Button className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={handleSave}>{t.save}</Button>
          </>
        }
      >
          <div className="space-y-4 form-animate">
            <InputField
              value={form.creditor_name}
              onChange={e => setForm(f => ({ ...f, creditor_name: (e.target as HTMLInputElement).value }))}
              icon={<Landmark className="w-3 h-3" />}
              label={t.creditor}
              error={formErrors.creditor_name}
              placeholder={locale === 'fr' ? 'Ex: Banque Atlantique' : 'E.g: Bank of America'}
            />
            <div className="grid grid-cols-2 gap-4">
              <InputField
                type="number" min="1"
                value={form.total_amount}
                onChange={e => setForm(f => ({ ...f, total_amount: (e.target as HTMLInputElement).value }))}
                prefix={currencySymbol(currency)}
                label={amountLabel(t.totalDebt, currency)}
                error={formErrors.total_amount}
                placeholder={exampleAmount(currency, locale)}
              />
              <InputField
                type="number" min="0"
                value={form.paid_amount}
                onChange={e => setForm(f => ({ ...f, paid_amount: (e.target as HTMLInputElement).value }))}
                prefix={currencySymbol(currency)}
                label={amountLabel(t.paidAmount, currency)}
                error={formErrors.paid_amount}
                placeholder={exampleAmount(currency, locale)}
              />
            </div>
            {Number(form.total_amount) > 0 && Number(form.paid_amount) >= 0 && (
              <div className="rounded-xl bg-muted/40 p-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t.remainingDebt}</span>
                <span className="text-sm font-bold text-destructive">{fmt(Math.max(0, Number(form.total_amount) - Number(form.paid_amount)))}</span>
              </div>
            )}
            <InputField
              type="date"
              value={form.due_date}
              onChange={e => setForm(f => ({ ...f, due_date: (e.target as HTMLInputElement).value }))}
              icon={<Target className="w-3 h-3" />}
              label={`${t.deadline} (${t.optional})`}
            />
            <div className="space-y-2">
              <Label className="form-label flex items-center gap-1.5"><CreditCard className="w-3 h-3" />{locale === 'fr' ? 'Compte de remboursement' : 'Repayment account'} ({t.optional})</Label>
              <AccountCombobox
                accounts={accounts}
                value={form.account_id}
                onValueChange={v => setForm(f => ({ ...f, account_id: v }))}
                placeholder={locale === 'fr' ? 'Sélectionner un compte...' : 'Select account...'}
              />
            </div>
            <InputField
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: (e.target as HTMLInputElement).value }))}
              maxLength={200}
              charCount
              label={`${t.notes} (${t.optional})`}
              placeholder={locale === 'fr' ? 'Notes...' : 'Notes...'}
            />
          </div>
      </ResponsiveFormDialog>

      <Dialog open={!!payDialog} onOpenChange={() => { setPayDialog(null); setPayAccountId(''); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{locale === 'fr' ? 'Rembourser' : 'Make payment'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.amount}</Label>
              <Input type="number" min="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="rounded-xl h-11 text-lg font-bold" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"><CreditCard className="w-3 h-3" />{locale === 'fr' ? 'Compte source' : 'Source account'}</Label>
              <AccountCombobox
                accounts={accounts}
                value={payAccountId || (debts.find(d => d.id === payDialog) as any)?.account_id || ''}
                onValueChange={v => setPayAccountId(v)}
                placeholder={locale === 'fr' ? 'Sélectionner un compte...' : 'Select account...'}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0"><Button variant="outline" onClick={() => setPayDialog(null)} className="rounded-xl">{t.cancel}</Button><Button className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={handlePay}>{t.save}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} onConfirm={handleDelete} title={t.confirmDelete} description={t.confirmDeleteMessage} cancelLabel={t.cancel} confirmLabel={t.delete} />
      <ConfirmDeleteDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen} onConfirm={handleBulkDelete}
        title={locale === 'fr' ? `Supprimer ${bulk.count} dette(s)` : `Delete ${bulk.count} debt(s)`}
        description={locale === 'fr' ? 'Cette action est irréversible.' : 'This action cannot be undone.'}
        cancelLabel={t.cancel} confirmLabel={t.delete} />
    </div>
  );
};

export default DebtsPage;
