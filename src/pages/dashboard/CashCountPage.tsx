import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Plus, Coins, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDeleteDialog from '@/components/dashboard/ConfirmDeleteDialog';

// Denominations by currency
const DENOMINATIONS: Record<string, number[]> = {
  XOF: [10000, 5000, 2000, 1000, 500, 250, 200, 100, 50, 25, 10, 5],
  XAF: [10000, 5000, 2000, 1000, 500, 100, 50, 25, 10, 5],
  EUR: [500, 200, 100, 50, 20, 10, 5, 2, 1, 0.50, 0.20, 0.10, 0.05, 0.02, 0.01],
  USD: [100, 50, 20, 10, 5, 2, 1, 0.50, 0.25, 0.10, 0.05, 0.01],
  GNF: [20000, 10000, 5000, 2000, 1000, 500, 100],
};

const CashCountPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency, currency } = useProfile();
  const t = dashT[locale];
  const [cashAccounts, setCashAccounts] = useState<Tables<'payment_accounts'>[]>([]);
  const [counts, setCounts] = useState<(Tables<'cash_counts'> & { payment_accounts?: { name: string; icon: string } | null })[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [countNotes, setCountNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fmt = (n: number) => fmtCurrency(n, locale);
  const denoms = DENOMINATIONS[currency] || DENOMINATIONS.EUR;

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [accRes, countRes] = await Promise.all([
      supabase.from('payment_accounts').select('*').eq('user_id', user.id).eq('type', 'cash'),
      supabase.from('cash_counts').select('*, payment_accounts(name, icon)').eq('user_id', user.id).order('counted_at', { ascending: false }).limit(20),
    ]);
    setCashAccounts(accRes.data || []);
    setCounts(countRes.data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalCounted = denoms.reduce((s, d) => s + (quantities[d] || 0) * d, 0);

  const handleSave = async () => {
    if (!user || !selectedAccountId) return;
    const account = cashAccounts.find(a => a.id === selectedAccountId);
    const expected = account ? Number(account.real_balance) : 0;
    const { error } = await supabase.from('cash_counts').insert({
      user_id: user.id,
      account_id: selectedAccountId,
      denominations: quantities,
      total_counted: totalCounted,
      expected_balance: expected,
      discrepancy: totalCounted - expected,
      notes: countNotes || null,
    });
    if (error) { toast.error(error.message); return; }
    setDialogOpen(false);
    setQuantities({});
    setCountNotes('');
    fetchData();
    toast.success(t.saved);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('cash_counts').delete().eq('id', deleteId);
    setDeleteId(null);
    fetchData();
  };

  const openNew = () => {
    setQuantities({});
    setCountNotes('');
    setSelectedAccountId(cashAccounts[0]?.id || '');
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between"><Skeleton className="h-8 w-32" /><Skeleton className="h-9 w-36" /></div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold font-display">{t.cashCount}</h2>
        <Button size="sm" className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={openNew} disabled={cashAccounts.length === 0}>
          <Plus className="w-4 h-4 mr-1" />{locale === 'fr' ? 'Nouveau comptage' : 'New count'}
        </Button>
      </div>

      {cashAccounts.length === 0 && (
        <Card className="border border-border/50 shadow-[var(--shadow-card)] rounded-2xl">
          <CardContent className="py-12 text-center">
            <Coins className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{locale === 'fr' ? 'Ajoutez d\'abord un compte de type "Espèces"' : 'Add a "Cash" type account first'}</p>
          </CardContent>
        </Card>
      )}

      {/* History */}
      {counts.length > 0 && (
        <Card className="border border-border/50 shadow-[var(--shadow-card)] rounded-2xl">
          <CardHeader><CardTitle className="text-base">{locale === 'fr' ? 'Historique' : 'History'}</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.date}</TableHead>
                    <TableHead>{t.account}</TableHead>
                    <TableHead className="text-right">{(t as any).counted || 'Compté'}</TableHead>
                    <TableHead className="text-right">{(t as any).expected || 'Attendu'}</TableHead>
                    <TableHead className="text-right">{t.discrepancy}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {counts.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm">{new Date(c.counted_at).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US')}</TableCell>
                      <TableCell className="text-sm">{(c.payment_accounts as any)?.icon} {(c.payment_accounts as any)?.name}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{fmt(Number(c.total_counted))}</TableCell>
                      <TableCell className="text-right text-sm">{fmt(Number(c.expected_balance))}</TableCell>
                      <TableCell className={`text-right text-sm font-bold ${Number(c.discrepancy) === 0 ? 'text-secondary' : 'text-destructive'}`}>
                        {Number(c.discrepancy) >= 0 ? '+' : ''}{fmt(Number(c.discrepancy))}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(c.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Count Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{(t as any).cashCount || 'PV d\'espèces'}</DialogTitle>
            <DialogDescription>{locale === 'fr' ? 'Comptez les billets et pièces' : 'Count bills and coins'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.account}</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="rounded-xl h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {cashAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{(t as any).denomination || 'Dénominations'}</Label>
              <div className="grid grid-cols-2 gap-2">
                {denoms.map(d => (
                  <div key={d} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                    <span className="text-sm font-medium w-16">{d >= 1 ? d.toLocaleString() : d}</span>
                    <span className="text-muted-foreground text-xs">×</span>
                    <Input
                      type="number" min="0" value={quantities[d] || ''}
                      onChange={e => setQuantities(q => ({ ...q, [d]: Number(e.target.value) || 0 }))}
                      className="h-8 w-16 text-center rounded-lg text-sm"
                    />
                    <span className="text-xs text-muted-foreground ml-auto">{fmt((quantities[d] || 0) * d)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-primary/5 rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">{locale === 'fr' ? 'Total compté' : 'Total counted'}</p>
              <p className="text-2xl font-extrabold">{fmt(totalCounted)}</p>
              {selectedAccountId && (() => {
                const acc = cashAccounts.find(a => a.id === selectedAccountId);
                const expected = acc ? Number(acc.real_balance) : 0;
                const diff = totalCounted - expected;
                return (
                  <p className={`text-sm mt-1 font-semibold ${diff === 0 ? 'text-secondary' : 'text-destructive'}`}>
                    {t.discrepancy}: {diff >= 0 ? '+' : ''}{fmt(diff)}
                  </p>
                );
              })()}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.notes} ({t.optional})</Label>
              <Input value={countNotes} onChange={e => setCountNotes(e.target.value)} className="rounded-xl h-11" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">{t.cancel}</Button>
            <Button className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={handleSave}>{t.save}</Button>
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

export default CashCountPage;
