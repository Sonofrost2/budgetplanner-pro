import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Flame, AlertTriangle, Crown } from 'lucide-react';

interface Props {
  userId: string | undefined;
  fmt: (n: number) => string;
  locale: 'fr' | 'en';
  categories: Array<{ id: string; name: string; icon: string; type: string }>;
}

interface Insight {
  key: string;
  icon: React.ReactNode;
  text: string;
  tone: 'primary' | 'warn' | 'info';
}

export const TransactionInsightsBar = ({ userId, fmt, locale, categories }: Props) => {
  const { monthStart, prevStart, prevEnd } = useMemo(() => {
    const now = new Date();
    const ms = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const ps = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const pe = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    return { monthStart: ms, prevStart: ps, prevEnd: pe };
  }, []);

  const { data: insights = [] } = useQuery({
    queryKey: ['tx-insights', userId, monthStart],
    queryFn: async (): Promise<Insight[]> => {
      const [{ data: cur }, { data: prev }] = await Promise.all([
        supabase
          .from('transactions')
          .select('amount, type, category_id, description')
          .eq('user_id', userId!)
          .eq('type', 'expense')
          .is('deleted_at', null)
          .gte('date', monthStart),
        supabase
          .from('transactions')
          .select('amount, category_id')
          .eq('user_id', userId!)
          .eq('type', 'expense')
          .is('deleted_at', null)
          .gte('date', prevStart)
          .lte('date', prevEnd),
      ]);

      const result: Insight[] = [];
      const curTxs = cur ?? [];
      if (!curTxs.length) return result;

      // 1. Top expense (single transaction)
      const top = [...curTxs].sort((a, b) => Number(b.amount) - Number(a.amount))[0];
      if (top) {
        const catName = categories.find(c => c.id === top.category_id)?.name;
        result.push({
          key: 'top',
          icon: <Crown className="w-3.5 h-3.5" />,
          tone: 'primary',
          text: locale === 'fr'
            ? `Top dépense : ${top.description.slice(0, 22)} · ${fmt(Number(top.amount))}${catName ? ` (${catName})` : ''}`
            : `Top spend: ${top.description.slice(0, 22)} · ${fmt(Number(top.amount))}${catName ? ` (${catName})` : ''}`,
        });
      }

      // 2. Most active category
      const byCat = new Map<string, number>();
      for (const tx of curTxs) {
        if (!tx.category_id) continue;
        byCat.set(tx.category_id, (byCat.get(tx.category_id) || 0) + Number(tx.amount));
      }
      const sortedCats = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
      if (sortedCats.length > 0) {
        const [topCatId, topCatTotal] = sortedCats[0];
        const cat = categories.find(c => c.id === topCatId);
        if (cat) {
          result.push({
            key: 'cat',
            icon: <Flame className="w-3.5 h-3.5" />,
            tone: 'info',
            text: locale === 'fr'
              ? `Catégorie n°1 : ${cat.icon} ${cat.name} · ${fmt(topCatTotal)}`
              : `Top category: ${cat.icon} ${cat.name} · ${fmt(topCatTotal)}`,
          });
        }
      }

      // 3. Anomaly: category with biggest % increase vs prev month
      const prevByCat = new Map<string, number>();
      for (const tx of prev ?? []) {
        if (!tx.category_id) continue;
        prevByCat.set(tx.category_id, (prevByCat.get(tx.category_id) || 0) + Number(tx.amount));
      }
      let worst: { id: string; pct: number; delta: number } | null = null;
      for (const [catId, curTotal] of byCat.entries()) {
        const prevTotal = prevByCat.get(catId) || 0;
        if (prevTotal < 5000) continue; // ignore tiny baselines
        const pct = ((curTotal - prevTotal) / prevTotal) * 100;
        if (pct > 25 && (!worst || pct > worst.pct)) {
          worst = { id: catId, pct, delta: curTotal - prevTotal };
        }
      }
      if (worst) {
        const cat = categories.find(c => c.id === worst!.id);
        if (cat) {
          result.push({
            key: 'anomaly',
            icon: <AlertTriangle className="w-3.5 h-3.5" />,
            tone: 'warn',
            text: locale === 'fr'
              ? `${cat.icon} ${cat.name} : +${worst.pct.toFixed(0)}% vs mois dernier`
              : `${cat.icon} ${cat.name}: +${worst.pct.toFixed(0)}% vs last month`,
          });
        }
      }

      return result.slice(0, 3);
    },
    enabled: !!userId && categories.length > 0,
    staleTime: 60_000,
  });

  if (!insights.length) return null;

  const toneClasses: Record<Insight['tone'], string> = {
    primary: 'bg-primary/10 border-primary/25 text-primary',
    warn: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
    info: 'bg-secondary/10 border-secondary/25 text-secondary',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="flex flex-wrap gap-2"
    >
      <AnimatePresence>
        {insights.map((ins, i) => (
          <motion.div
            key={ins.key}
            initial={{ opacity: 0, scale: 0.95, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-semibold backdrop-blur-sm ${toneClasses[ins.tone]}`}
          >
            {ins.icon}
            <span className="truncate max-w-[280px]">{ins.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
};
