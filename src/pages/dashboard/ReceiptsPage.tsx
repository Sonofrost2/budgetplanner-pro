import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Receipt, Inbox } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const ReceiptsPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const t = dashT[locale];
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('payment_receipts').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setReceipts(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold font-display">{t.receipts}</h2>

      {receipts.length === 0 ? (
        <Card className="border-none shadow-[var(--shadow-card)]">
          <CardContent className="py-16 text-center">
            <Inbox className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-lg font-medium text-muted-foreground">{t.noReceipts}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-none shadow-[var(--shadow-card)]">
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {receipts.map(r => (
                <div key={r.id} className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <Receipt className="w-5 h-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{r.plan_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">
                      {Number(r.amount).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US', { style: 'currency', currency: r.currency })}
                    </span>
                    <Badge variant={r.status === 'confirmed' ? 'default' : 'secondary'} className="text-xs">
                      {r.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReceiptsPage;
