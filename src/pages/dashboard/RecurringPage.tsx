import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { useRecurring, useCategories, useAccounts, useInvalidate } from '@/hooks/useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Plus, RefreshCw, Pencil, Trash2, Sparkles, Check, X, Zap, TrendingDown, TrendingUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDeleteDialog from '@/components/dashboard/ConfirmDeleteDialog';
import { AccountCombobox } from '@/components/dashboard/AccountCombobox';

interface AIPattern {
  description: string;
  average_amount: number;
  type: 'income' | 'expense';
  frequency: string;
  category_name?: string;
  category_icon?: string;
  category_id?: string;
  account_id?: string;
  occurrences: number;
  confidence: number;
  last_date: string;
  account_description?: string;
}

const RecurringPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const t = dashT[locale] as any;
  const { invalidate } = useInvalidate();

  const { data: items = [], isLoading: recLoading } = useRecurring();
  const { data: categories = [], isLoading: catLoading } = useCategories();
  const { data: accounts = [], isLoading: accLoading } = useAccounts();
  const loading = recLoading || catLoading || accLoading;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ description: '', amount: '', type: 'expense', category_id: '', account_id: '', frequency: 'monthly', next_date: '', active: true });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('confirmed');

  // AI detection state
  const [aiPatterns, setAiPatterns] = useState<AIPattern[]>([]);
  const [aiDetecting, setAiDetecting] = useState(false);
  const [aiDone, setAiDone] = useState(false);

  const fmt = (n: number) => fmtCurrency(n, locale);
  const refreshData = () => invalidate('recurring');

  const freqMap: Record<string, string> = {
    daily: t.daily, weekly: t.weekly, monthly: t.monthly,
    quarterly: t.quarterly, semi_annual: t.semiAnnual, yearly: t.yearly,
  };

  const handleSave = async () => {
    if (!user || !form.description.trim() || Number(form.amount) <= 0 || !form.next_date) return;
    const payload = { description: form.description.trim(), amount: Number(form.amount), type: form.type, category_id: form.category_id || null, account_id: form.account_id || null, frequency: form.frequency, next_date: form.next_date, active: form.active };
    const { error } = editId
      ? await supabase.from('recurring_transactions').update(payload).eq('id', editId)
      : await supabase.from('recurring_transactions').insert({ ...payload, user_id: user.id });
    if (error) { toast.error(error.message); return; }
    setDialogOpen(false); setEditId(null);
    refreshData(); toast.success(t.saved);
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from('recurring_transactions').update({ active: !active }).eq('id', id);
    refreshData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('recurring_transactions').delete().eq('id', deleteId);
    setDeleteId(null); refreshData();
  };

  const openNew = () => { setEditId(null); setForm({ description: '', amount: '', type: 'expense', category_id: '', account_id: '', frequency: 'monthly', next_date: new Date().toISOString().split('T')[0], active: true }); setDialogOpen(true); };
  const openEdit = (r: any) => { setEditId(r.id); setForm({ description: r.description, amount: String(r.amount), type: r.type, category_id: r.category_id || '', account_id: r.account_id || '', frequency: r.frequency, next_date: r.next_date, active: r.active }); setDialogOpen(true); };

  // AI Detection
  const runAiDetection = async () => {
    setAiDetecting(true);
    setAiPatterns([]);
    setAiDone(false);
    try {
      const { data, error } = await supabase.functions.invoke('ai-detect-recurring');
      if (error) throw error;
      const patterns = data?.patterns || [];
      setAiPatterns(patterns);
      setAiDone(true);
      if (patterns.length > 0) {
        toast.success(t.aiDetected(patterns.length));
        setActiveTab('suggestions');
      } else {
        toast.info(t.aiNoPatterns);
      }
    } catch (e: any) {
      console.error('AI detection error:', e);
      toast.error(e.message || 'AI detection failed');
    } finally {
      setAiDetecting(false);
    }
  };

  const acceptPattern = async (pattern: AIPattern) => {
    if (!user) return;
    // Map AI frequency to DB frequency
    const freqMapping: Record<string, string> = {
      daily: 'daily', weekly: 'weekly', monthly: 'monthly',
      quarterly: 'quarterly', semi_annual: 'semi_annual', yearly: 'yearly',
    };
    const nextDate = computeNextDate(pattern.last_date, pattern.frequency);
    const payload = {
      user_id: user.id,
      description: pattern.description,
      amount: Math.round(pattern.average_amount),
      type: pattern.type,
      category_id: pattern.category_id || null,
      account_id: pattern.account_id || null,
      frequency: freqMapping[pattern.frequency] || 'monthly',
      next_date: nextDate,
      active: true,
    };
    const { error } = await supabase.from('recurring_transactions').insert(payload);
    if (error) { toast.error(error.message); return; }
    setAiPatterns(prev => prev.filter(p => p.description !== pattern.description));
    refreshData();
    toast.success(t.saved);
  };

  const acceptAllPatterns = async () => {
    if (!user) return;
    for (const pattern of aiPatterns) {
      const nextDate = computeNextDate(pattern.last_date, pattern.frequency);
      const payload = {
        user_id: user.id,
        description: pattern.description,
        amount: Math.round(pattern.average_amount),
        type: pattern.type,
        category_id: pattern.category_id || null,
        account_id: pattern.account_id || null,
        frequency: pattern.frequency,
        next_date: nextDate,
        active: true,
      };
      await supabase.from('recurring_transactions').insert(payload);
    }
    setAiPatterns([]);
    refreshData();
    toast.success(t.saved);
  };

  const rejectPattern = (pattern: AIPattern) => {
    setAiPatterns(prev => prev.filter(p => p.description !== pattern.description));
  };

  const computeNextDate = (lastDate: string, frequency: string): string => {
    const d = new Date(lastDate);
    switch (frequency) {
      case 'daily': d.setDate(d.getDate() + 1); break;
      case 'weekly': d.setDate(d.getDate() + 7); break;
      case 'monthly': d.setMonth(d.getMonth() + 1); break;
      case 'quarterly': d.setMonth(d.getMonth() + 3); break;
      case 'semi_annual': d.setMonth(d.getMonth() + 6); break;
      case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
      default: d.setMonth(d.getMonth() + 1);
    }
    return d.toISOString().split('T')[0];
  };

  const totalFixedExpenses = items.filter(i => i.active && i.type === 'expense').reduce((s, i) => s + Number(i.amount), 0);
  const totalFixedIncome = items.filter(i => i.active && i.type === 'income').reduce((s, i) => s + Number(i.amount), 0);

  if (loading) return <div className="space-y-6"><div className="flex items-center justify-between"><Skeleton className="h-8 w-32" /><Skeleton className="h-9 w-36" /></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold font-display">{t.recurring}</h2>
          {items.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {t.fixedCharges}: <span className="text-destructive font-semibold">{fmt(totalFixedExpenses)}</span>
              {totalFixedIncome > 0 && <> · {t.income}: <span className="text-secondary font-semibold">{fmt(totalFixedIncome)}</span></>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl gap-1.5"
            onClick={runAiDetection}
            disabled={aiDetecting}
          >
            {aiDetecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {aiDetecting ? t.aiDetecting : t.aiDetect}
          </Button>
          <Button size="sm" className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={openNew}>
            <Plus className="w-4 h-4 mr-1" />{t.addRecurring}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="rounded-xl">
          <TabsTrigger value="confirmed" className="rounded-lg gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" />
            {t.aiConfirmed} ({items.length})
          </TabsTrigger>
          {(aiPatterns.length > 0 || aiDone) && (
            <TabsTrigger value="suggestions" className="rounded-lg gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              {t.aiSuggestions} ({aiPatterns.length})
            </TabsTrigger>
          )}
        </TabsList>

        {/* Confirmed recurring */}
        <TabsContent value="confirmed" className="mt-4">
          {items.length === 0 ? (
            <Card className="border border-border/50 shadow-[var(--shadow-card)] rounded-2xl">
              <CardContent className="py-16 text-center">
                <RefreshCw className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
                <p className="text-lg font-semibold text-muted-foreground mb-2">
                  {locale === 'fr' ? 'Aucune charge récurrente' : 'No recurring transactions'}
                </p>
                <p className="text-sm text-muted-foreground/70 mb-4">
                  {locale === 'fr'
                    ? 'Utilisez l\'IA pour détecter automatiquement vos charges récurrentes à partir de vos transactions.'
                    : 'Use AI to automatically detect recurring charges from your transactions.'}
                </p>
                <div className="flex items-center justify-center gap-2">
                  <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={runAiDetection} disabled={aiDetecting}>
                    {aiDetecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {t.aiDetect}
                  </Button>
                  <Button size="sm" className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={openNew}>
                    <Plus className="w-4 h-4 mr-1" />{t.addRecurring}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map(r => (
                <Card key={r.id} className={`border border-border/50 shadow-[var(--shadow-card)] rounded-2xl ${!r.active ? 'opacity-50' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-bold flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: (r.categories?.color || '#6C63FF') + '20' }}>{r.categories?.icon || '📁'}</div>
                        <div><span>{r.description}</span><p className="text-[11px] font-normal text-muted-foreground">{freqMap[r.frequency || 'monthly'] || r.frequency}</p></div>
                      </CardTitle>
                      <div className="flex items-center gap-1">
                        <Switch checked={r.active ?? true} onCheckedChange={() => toggleActive(r.id, r.active ?? true)} className="scale-75" />
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary" onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className={`text-xl font-extrabold ${r.type === 'income' ? 'text-secondary' : 'text-destructive'}`}>{r.type === 'income' ? '+' : '-'}{fmt(Number(r.amount))}</span>
                      <Badge variant="outline" className="text-[10px]">{t.nextDate}: {new Date(r.next_date).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* AI Suggestions */}
        <TabsContent value="suggestions" className="mt-4 space-y-4">
          {aiPatterns.length === 0 ? (
            <Card className="border border-border/50 shadow-[var(--shadow-card)] rounded-2xl">
              <CardContent className="py-12 text-center">
                <Sparkles className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">
                  {aiDone ? t.aiNoPatterns : (locale === 'fr' ? 'Lancez l\'analyse IA pour détecter vos patterns' : 'Run AI analysis to detect your patterns')}
                </p>
                {!aiDone && (
                  <Button variant="outline" size="sm" className="rounded-xl gap-1.5 mt-3" onClick={runAiDetection} disabled={aiDetecting}>
                    {aiDetecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {t.aiDetect}
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{t.aiDetected(aiPatterns.length)}</p>
                <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={acceptAllPatterns}>
                  <Check className="w-3.5 h-3.5" />{t.aiAcceptAll}
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {aiPatterns.map((pattern, idx) => (
                  <Card key={idx} className="border border-primary/20 shadow-[var(--shadow-card)] rounded-2xl bg-primary/[0.02]">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-bold flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-primary/10">
                            {pattern.category_icon || (pattern.type === 'income' ? '💰' : '💳')}
                          </div>
                          <div>
                            <span>{pattern.description}</span>
                            <p className="text-[11px] font-normal text-muted-foreground">
                              {freqMap[pattern.frequency] || pattern.frequency}
                              {pattern.category_name && ` · ${pattern.category_name}`}
                            </p>
                          </div>
                        </CardTitle>
                        <Badge variant="outline" className="text-[9px] gap-1">
                          <Sparkles className="w-2.5 h-2.5" />IA
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className={`text-xl font-extrabold ${pattern.type === 'income' ? 'text-secondary' : 'text-destructive'}`}>
                          {pattern.type === 'income' ? '+' : '-'}{fmt(Math.round(pattern.average_amount))}
                        </span>
                        <div className="text-right">
                          <p className="text-[10px] text-muted-foreground">{t.aiOccurrences}: {pattern.occurrences}</p>
                        </div>
                      </div>

                      {/* Confidence bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-muted-foreground">{t.aiConfidence}</span>
                          <span className={`font-bold ${pattern.confidence >= 80 ? 'text-secondary' : pattern.confidence >= 60 ? 'text-accent' : 'text-muted-foreground'}`}>{pattern.confidence}%</span>
                        </div>
                        <Progress value={pattern.confidence} className={`h-1.5 rounded-full ${pattern.confidence >= 80 ? '[&>div]:bg-secondary' : pattern.confidence >= 60 ? '[&>div]:bg-accent' : ''}`} />
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-1">
                        <Button size="sm" className="flex-1 text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={() => acceptPattern(pattern)}>
                          <Check className="w-3.5 h-3.5 mr-1" />{t.aiAccept}
                        </Button>
                        <Button variant="ghost" size="sm" className="rounded-xl text-muted-foreground" onClick={() => rejectPattern(pattern)}>
                          <X className="w-3.5 h-3.5 mr-1" />{t.aiReject}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditId(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle className="text-xl font-bold">{editId ? t.edit : t.addRecurring}</DialogTitle><DialogDescription>{locale === 'fr' ? 'Configurez une transaction récurrente' : 'Configure a recurring transaction'}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.description}</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="rounded-xl h-11" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.amount}</Label><Input type="number" min="1" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="rounded-xl h-11 text-lg font-bold" /></div>
              <div className="space-y-2"><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.type}</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}><SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="expense">{t.expenseType}</SelectItem><SelectItem value="income">{t.incomeType}</SelectItem></SelectContent></Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.frequency}</Label>
                <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v }))}>
                  <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">{t.daily}</SelectItem>
                    <SelectItem value="weekly">{t.weekly}</SelectItem>
                    <SelectItem value="monthly">{t.monthly}</SelectItem>
                    <SelectItem value="quarterly">{t.quarterly}</SelectItem>
                    <SelectItem value="semi_annual">{t.semiAnnual}</SelectItem>
                    <SelectItem value="yearly">{t.yearly}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.nextDate}</Label><Input type="date" value={form.next_date} onChange={e => setForm(f => ({ ...f, next_date: e.target.value }))} className="rounded-xl h-11" /></div>
            </div>
            <div className="space-y-2"><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.category} ({t.optional})</Label>
              <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v }))}><SelectTrigger className="rounded-xl h-11"><SelectValue placeholder={t.selectCategory} /></SelectTrigger><SelectContent>{categories.filter(c => c.type === form.type).map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-2"><Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.account} ({t.optional})</Label>
              <AccountCombobox accounts={accounts} value={form.account_id} onValueChange={v => setForm(f => ({ ...f, account_id: v }))} placeholder={t.selectAccount} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0"><Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">{t.cancel}</Button><Button className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={handleSave}>{t.save}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)} onConfirm={handleDelete} title={t.confirmDelete} description={t.confirmDeleteMessage} cancelLabel={t.cancel} confirmLabel={t.delete} />
    </div>
  );
};

export default RecurringPage;
