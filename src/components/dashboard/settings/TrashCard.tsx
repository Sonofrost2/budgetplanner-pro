import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

const TABLES = [
  { key: 'transactions', label: { fr: 'Transactions', en: 'Transactions' }, displayField: 'description' },
  { key: 'budgets', label: { fr: 'Budgets', en: 'Budgets' }, displayField: 'name' },
  { key: 'debts', label: { fr: 'Dettes', en: 'Debts' }, displayField: 'creditor_name' },
  { key: 'savings_goals', label: { fr: 'Épargne', en: 'Savings' }, displayField: 'name' },
  { key: 'payment_accounts', label: { fr: 'Comptes', en: 'Accounts' }, displayField: 'name' },
  { key: 'categories', label: { fr: 'Catégories', en: 'Categories' }, displayField: 'name' },
  { key: 'recurring_transactions', label: { fr: 'Récurrences', en: 'Recurring' }, displayField: 'description' },
] as const;

type TableKey = typeof TABLES[number]['key'];

interface DeletedRow {
  id: string;
  deleted_at: string;
  [k: string]: unknown;
}

export const TrashCard = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const fr = locale === 'fr';
  const [data, setData] = useState<Record<TableKey, DeletedRow[]>>({} as Record<TableKey, DeletedRow[]>);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<TableKey>('transactions');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const result: Record<string, DeletedRow[]> = {};
    for (const t of TABLES) {
      const { data: rows } = await supabase
        .from(t.key as TableKey)
        .select('*')
        .eq('user_id', user.id)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false })
        .limit(100);
      result[t.key] = (rows as DeletedRow[]) ?? [];
    }
    setData(result as Record<TableKey, DeletedRow[]>);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const restore = async (table: TableKey, id: string) => {
    const { error } = await supabase.from(table).update({ deleted_at: null } as never).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success(fr ? 'Restauré' : 'Restored');
    load();
  };

  const purge = async (table: TableKey, id: string) => {
    if (!confirm(fr ? 'Suppression définitive ? Action irréversible.' : 'Permanent delete? Cannot be undone.')) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success(fr ? 'Supprimé définitivement' : 'Permanently deleted');
    load();
  };

  const purgeAll = async (table: TableKey) => {
    if (!user) return;
    if (!confirm(fr ? 'Vider la corbeille de cette section ?' : 'Empty trash for this section?')) return;
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('user_id', user.id)
      .not('deleted_at', 'is', null);
    if (error) { toast.error(error.message); return; }
    toast.success(fr ? 'Corbeille vidée' : 'Trash emptied');
    load();
  };

  const getDisplay = (row: DeletedRow, table: TableKey) => {
    const def = TABLES.find(t => t.key === table);
    return String(row[def!.displayField] ?? row.id);
  };

  const daysLeft = (deletedAt: string) => {
    const ms = new Date(deletedAt).getTime() + 30 * 86400_000 - Date.now();
    return Math.max(0, Math.ceil(ms / 86400_000));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="w-5 h-5" />
          {fr ? 'Corbeille' : 'Trash'}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {fr ? 'Les éléments sont conservés 30 jours puis supprimés automatiquement.' : 'Items are kept 30 days then auto-deleted.'}
        </p>
      </CardHeader>
      <CardContent>
        <Tabs value={active} onValueChange={(v) => setActive(v as TableKey)}>
          <TabsList className="flex flex-wrap h-auto">
            {TABLES.map(t => (
              <TabsTrigger key={t.key} value={t.key} className="text-xs">
                {t.label[locale as 'fr' | 'en']} {data[t.key]?.length ? `(${data[t.key].length})` : ''}
              </TabsTrigger>
            ))}
          </TabsList>

          {TABLES.map(t => (
            <TabsContent key={t.key} value={t.key} className="mt-4">
              {loading ? (
                <p className="text-sm text-muted-foreground py-8 text-center">{fr ? 'Chargement...' : 'Loading...'}</p>
              ) : !data[t.key]?.length ? (
                <p className="text-sm text-muted-foreground py-8 text-center">{fr ? 'Corbeille vide' : 'Trash is empty'}</p>
              ) : (
                <>
                  <div className="flex justify-end mb-2">
                    <Button variant="ghost" size="sm" onClick={() => purgeAll(t.key)} className="text-destructive">
                      <Trash2 className="w-4 h-4 mr-1" />
                      {fr ? 'Vider' : 'Empty'}
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {data[t.key].map(row => {
                      const left = daysLeft(row.deleted_at);
                      return (
                        <div key={row.id} className="flex items-center justify-between gap-2 p-3 rounded-lg border border-border bg-muted/30">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{getDisplay(row, t.key)}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              {left <= 3 && <AlertTriangle className="w-3 h-3 text-warning" />}
                              {fr ? `Supprimé le ${new Date(row.deleted_at).toLocaleDateString('fr-FR')} • ${left}j restant(s)` : `Deleted ${new Date(row.deleted_at).toLocaleDateString('en-US')} • ${left}d left`}
                            </p>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button size="sm" variant="outline" onClick={() => restore(t.key, row.id)}>
                              <RotateCcw className="w-3 h-3 mr-1" />
                              {fr ? 'Restaurer' : 'Restore'}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => purge(t.key, row.id)} className="text-destructive">
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};
