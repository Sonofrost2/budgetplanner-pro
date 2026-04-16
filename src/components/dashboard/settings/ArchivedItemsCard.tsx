import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Archive, RotateCcw, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { unarchiveItem } from '@/lib/archive';
import { toast } from 'sonner';

export const ArchivedItemsCard = ({ locale = 'fr' }: { locale?: string }) => {
  const { user } = useAuth();
  const fr = locale === 'fr';
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [a, c] = await Promise.all([
      supabase.from('payment_accounts').select('*').eq('user_id', user.id).not('archived_at', 'is', null),
      supabase.from('categories').select('*').eq('user_id', user.id).not('archived_at', 'is', null),
    ]);
    setAccounts(a.data || []); setCategories(c.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const restore = async (table: 'payment_accounts' | 'categories', id: string) => {
    const { error } = await unarchiveItem(table, id);
    if (error) toast.error(error.message); else { toast.success(fr ? 'Restauré' : 'Restored'); load(); }
  };

  return (
    <Card className="p-5 bg-card/40 backdrop-blur-xl border border-border/40 rounded-2xl">
      <div className="flex items-center gap-2 mb-4">
        <Archive className="w-4 h-4 text-primary" />
        <h3 className="font-semibold">{fr ? 'Éléments archivés' : 'Archived items'}</h3>
      </div>
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <Tabs defaultValue="accounts">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="accounts">{fr ? 'Comptes' : 'Accounts'} ({accounts.length})</TabsTrigger>
            <TabsTrigger value="categories">{fr ? 'Catégories' : 'Categories'} ({categories.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="accounts" className="space-y-2 mt-3">
            {accounts.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">{fr ? 'Aucun compte archivé' : 'No archived accounts'}</p> :
              accounts.map(a => (
                <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                  <span>{a.icon}</span>
                  <span className="text-sm flex-1">{a.name}</span>
                  <Button size="sm" variant="ghost" onClick={() => restore('payment_accounts', a.id)} className="h-7 text-xs gap-1">
                    <RotateCcw className="w-3 h-3" />{fr ? 'Restaurer' : 'Restore'}
                  </Button>
                </div>
              ))}
          </TabsContent>
          <TabsContent value="categories" className="space-y-2 mt-3">
            {categories.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">{fr ? 'Aucune catégorie archivée' : 'No archived categories'}</p> :
              categories.map(c => (
                <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                  <span>{c.icon}</span>
                  <span className="text-sm flex-1">{c.name}</span>
                  <Button size="sm" variant="ghost" onClick={() => restore('categories', c.id)} className="h-7 text-xs gap-1">
                    <RotateCcw className="w-3 h-3" />{fr ? 'Restaurer' : 'Restore'}
                  </Button>
                </div>
              ))}
          </TabsContent>
        </Tabs>
      )}
    </Card>
  );
};
