import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Plus, Trash2, PiggyBank } from 'lucide-react';
import { toast } from 'sonner';

const SavingsPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const t = dashT[locale];
  const [goals, setGoals] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [addAmountDialog, setAddAmountDialog] = useState<string | null>(null);
  const [addAmount, setAddAmount] = useState('');
  const [form, setForm] = useState({ name: '', target_amount: '', icon: '🎯', deadline: '' });

  const fmt = (n: number) => n.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US', { style: 'currency', currency: 'EUR' });

  const fetchData = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('savings_goals').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setGoals(data || []);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!user || !form.name.trim() || Number(form.target_amount) <= 0) return;
    const { error } = await supabase.from('savings_goals').insert({
      user_id: user.id, name: form.name.trim(), target_amount: Number(form.target_amount),
      icon: form.icon || '🎯', deadline: form.deadline || null,
    });
    if (error) { toast.error(error.message); return; }
    setDialogOpen(false);
    fetchData();
    toast.success(t.saved);
  };

  const handleAddAmount = async () => {
    if (!addAmountDialog || Number(addAmount) <= 0) return;
    const goal = goals.find(g => g.id === addAmountDialog);
    if (!goal) return;
    const { error } = await supabase.from('savings_goals').update({
      current_amount: Number(goal.current_amount) + Number(addAmount),
    }).eq('id', addAmountDialog);
    if (error) { toast.error(error.message); return; }
    setAddAmountDialog(null);
    setAddAmount('');
    fetchData();
    toast.success(t.saved);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('savings_goals').delete().eq('id', id);
    fetchData();
  };

  const icons = ['🎯', '🏖️', '🏠', '🚗', '💻', '📚', '💍', '🎓', '🛡️', '✈️'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold font-display">{t.savings}</h2>
        <Button size="sm" className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }} onClick={() => {
          setForm({ name: '', target_amount: '', icon: '🎯', deadline: '' });
          setDialogOpen(true);
        }}>
          <Plus className="w-4 h-4 mr-1" />{t.addGoal}
        </Button>
      </div>

      {goals.length === 0 ? (
        <Card className="border-none shadow-[var(--shadow-card)]">
          <CardContent className="py-12 text-center">
            <PiggyBank className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{t.noGoals}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map(g => {
            const pct = Math.min((Number(g.current_amount) / Number(g.target_amount)) * 100, 100);
            const done = pct >= 100;
            return (
              <Card key={g.id} className={`border-none shadow-[var(--shadow-card)] ${done ? 'ring-2 ring-secondary/30' : ''}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <span className="text-xl">{g.icon}</span>{g.name}
                    </CardTitle>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => handleDelete(g.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>{fmt(Number(g.current_amount))}</span>
                    <span className="text-muted-foreground">{fmt(Number(g.target_amount))}</span>
                  </div>
                  <Progress value={pct} className={`h-3 ${done ? '[&>div]:bg-secondary' : '[&>div]:bg-primary'}`} />
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-muted-foreground">{pct.toFixed(0)}%{g.deadline ? ` · ${new Date(g.deadline).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US')}` : ''}</span>
                    {!done && (
                      <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => { setAddAmountDialog(g.id); setAddAmount(''); }}>
                        {t.addSaving}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create goal dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.addGoal}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t.goalName}</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label>Icône</Label>
              <div className="flex flex-wrap gap-2">
                {icons.map(ic => (
                  <button key={ic} onClick={() => setForm(f => ({ ...f, icon: ic }))}
                    className={`text-xl p-1.5 rounded-lg border transition-colors ${form.icon === ic ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t.targetAmount}</Label>
                <Input type="number" min="1" step="0.01" value={form.target_amount} onChange={e => setForm(f => ({ ...f, target_amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t.deadline}</Label>
                <Input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t.cancel}</Button>
            <Button className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }} onClick={handleCreate}>{t.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add amount dialog */}
      <Dialog open={!!addAmountDialog} onOpenChange={() => setAddAmountDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t.addSaving}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>{t.amount}</Label>
            <Input type="number" min="0.01" step="0.01" value={addAmount} onChange={e => setAddAmount(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddAmountDialog(null)}>{t.cancel}</Button>
            <Button className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }} onClick={handleAddAmount}>{t.save}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SavingsPage;
