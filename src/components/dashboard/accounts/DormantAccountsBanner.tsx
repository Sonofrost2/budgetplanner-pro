import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Moon, X, Archive } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useDormantAccounts } from '@/hooks/useAccountInsights';
import { useInvalidate } from '@/hooks/useDashboardData';

interface Props {
  isFr: boolean;
}

export const DormantAccountsBanner = ({ isFr }: Props) => {
  const { data: dormant = [] } = useDormantAccounts(90);
  const { invalidate } = useInvalidate();
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  if (dismissed || dormant.length === 0) return null;

  const handleArchiveAll = async () => {
    setBusy(true);
    const ids = dormant.map(d => d.id);
    const { error } = await supabase
      .from('payment_accounts')
      .update({ archived_at: new Date().toISOString(), status: 'dormant' })
      .in('id', ids);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    invalidate('accounts', 'dormant-accounts');
    toast.success(isFr ? `${ids.length} compte(s) archivé(s)` : `${ids.length} account(s) archived`);
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
      >
        <Card className="border border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-orange-500/5 rounded-2xl p-3 sm:p-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
              <Moon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">
                {isFr
                  ? `${dormant.length} compte${dormant.length > 1 ? 's' : ''} dormant${dormant.length > 1 ? 's' : ''}`
                  : `${dormant.length} dormant account${dormant.length > 1 ? 's' : ''}`}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isFr
                  ? `Aucun mouvement depuis 90+ jours: ${dormant.slice(0, 3).map(d => `${d.icon} ${d.name}`).join(', ')}${dormant.length > 3 ? ` +${dormant.length - 3}` : ''}`
                  : `No activity 90+ days: ${dormant.slice(0, 3).map(d => `${d.icon} ${d.name}`).join(', ')}${dormant.length > 3 ? ` +${dormant.length - 3}` : ''}`}
              </p>
              <div className="flex items-center gap-2 mt-2.5">
                <Button size="sm" variant="outline" className="h-7 rounded-lg text-xs gap-1" onClick={handleArchiveAll} disabled={busy}>
                  <Archive className="w-3 h-3" />
                  {isFr ? 'Tout archiver' : 'Archive all'}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 rounded-lg text-xs" onClick={() => setDismissed(true)}>
                  {isFr ? 'Plus tard' : 'Later'}
                </Button>
              </div>
            </div>
            <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
};
