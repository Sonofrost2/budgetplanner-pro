import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const BudgetsPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const t = dashT[locale];
  const [budgets, setBudgets] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [spending, setSpending] = useState<Record<string, number>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', amount: '', category_id: '', period: 'monthly' });

  const fmt = (n: number) => n.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US', { style: 'currency', currency: 'EUR' });

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [budRes, catRes] = await Promise.all([
      supabase.from('budgets').select('*, categories(name, icon, color)').eq('user_id', user.id),
      supabase.from('categories').select('*').eq('user_id', user.id).eq('type', 'expense'),
    ]);
    setBudgets(budRes.data || []);
    setCategories(catRes.data || []);

    // Get current month spending per category
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    const { data: txs } = await supabase.from('transactions').select('category_id, amount')
      .eq('user_id', user.id).eq('type', 'expense').gte('date', start).lte('date', end);
    
    const spendMap: Record<string, number> = {};
    (txs || []).forEach(tx => {
      if (tx.category_id) spendMap[tx.category_id] = (spendMap[tx.category_id] || 0) + Number(tx.amount);
    });
    setSpending(spendMap);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    if (!user || !form.name.trim() || !form.amount || Number(form.amount) <= 0) return;
    const { error } = await supabase.from('budgets').insert({
      user_id: user.id, name: form.name.trim(), amount: Number(form.amount),
      category_id: form.category_id || null, period: form.period,
    });
    if (error) { toast.error(error.message); return; }
    setDialogOpen(false);
    fetchData();
    toast.success(t.saved);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('budgets').delete().eq('id', id);
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold font-display">{t.budgets}</h2>
        <Button size="sm" className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }} onClick={() => {
          setForm({ name: '', amount: '', category_id: categories[0]?.id || '', period: 'monthly' });
          setDialogOpen(true);
        }}>
          <Plus className="w-4 h-4 mr-1" />{t.addBudget}
        </Button>
      </div>

      {budgets.length === 0 ? (
        <Card className="border-none shadow-[var(--shadow-card)]">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{t.noBudgets}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map(b => {
            const spent = spending[b.category_id] || 0;
            const pct = Math.min((spent / Number(b.amount)) * 100, 100);
            const over = spent > Number(b.amount);
            return (
              <Card key={b.id} className={`border-none shadow-[var(--shadow-card)] ${over ? 'ring-2 ring-destructive/30' : ''}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <span>{b.categories?.icon || '📁'}</span>
                      {b.name}
                    </CardTitle>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => handleDelete(b.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t.spent}: <strong className={over ? 'text-destructive' : ''}>{fmt(spent)}</strong></span>
                    <span className="text-muted-foreground">{t.budgetAmount}: <strong>{fmt(Number(b.amount))}</strong></span>
                  </div>
                  <Progress value={pct} className={`h-3 ${over ? '[&>div]:bg-destructive' : '[&>div]:bg-secondary'}`} />
                  {over ? (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {t.overBudget} {t.exceeded} {fmt(spent - Number(b.amount))}
                    </p>
                  ) : (
                    <p className="text-xs text-secondary">{t.onTrack} — {t.remaining}: {fmt(Number(b.amount) - spent)}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.addBudget}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t.budgetName}</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label>{t.category}</Label>
              <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.budgetAmount}</Label>
                <Input type="number" min="1" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t.period}</Label>
                <Select value={form.period} onValueChange={v => setForm(f => ({ ...f, period: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">{t.weekly}</SelectItem>
                    <SelectItem value="monthly">{t.monthly}</SelectItem>
                    <SelectItem value="yearly">{t.yearly}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t.cancel}</Button>
            <Button className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }} onClick={handleSave}>{t.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BudgetsPage;
