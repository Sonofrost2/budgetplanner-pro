import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Flame, AlertTriangle, Crown, Zap } from 'lucide-react';
import { isTransfer } from '@/lib/transactionMath';

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
  tone: 'primary' | 'warn' | 'info' | 'streak';
}

export const TransactionInsightsBar = ({ userId, fmt, locale, categories }: Props) => {
  const { monthStart, prevStart, prevEnd, streakWindowStart } = useMemo(() => {
    const now = new Date();
    const ms = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const ps = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const pe = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
    // Look back 90 days max for streak computation
    const sw = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 90).toISOString().split('T')[0];
    return { monthStart: ms, prevStart: ps, prevEnd: pe, streakWindowStart: sw };
  }, []);

  const { data: insights = [] } = useQuery({
    queryKey: ['tx-insights', userId, monthStart],
    queryFn: async (): Promise<Insight[]> => {
      const [{ data: cur }, { data: prev }, { data: streakRows }] = await Promise.all([
        supabase
          .from('transactions')
          .select('amount, type, category_id, description, linked_transfer_id')
          .eq('user_id', userId!)
          .eq('type', 'expense')
          .is('deleted_at', null)
          .gte('date', monthStart),
        supabase
          .from('transactions')
          .select('amount, category_id, description, linked_transfer_id')
          .eq('user_id', userId!)
          .eq('type', 'expense')
          .is('deleted_at', null)
          .gte('date', prevStart)
          .lte('date', prevEnd),
        supabase
          .from('transactions')
          .select('date')
          .eq('user_id', userId!)
          .is('deleted_at', null)
          .gte('date', streakWindowStart)
          .order('date', { ascending: false }),
      ]);

      const result: Insight[] = [];

      // 0. Streak: consecutive days with at least one transaction (ending today or yesterday)
      const dateSet = new Set<string>((streakRows ?? []).map((r: any) => r.date));
      if (dateSet.size > 0) {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        let streak = 0;
        const cursor = new Date(today);
        // Allow streak to start from yesterday if no entry today (don't break before user logs today)
        if (!dateSet.has(todayStr) && dateSet.has(yesterdayStr)) {
          cursor.setDate(cursor.getDate() - 1);
        }
        while (true) {
          const key = cursor.toISOString().split('T')[0];
          if (dateSet.has(key)) {
            streak += 1;
            cursor.setDate(cursor.getDate() - 1);
          } else {
            break;
          }
        }
        if (streak >= 2) {
          result.push({
            key: 'streak',
            icon: <Zap className="w-3.5 h-3.5" />,
            tone: 'streak',
            text: locale === 'fr'
              ? `Streak ${streak} jours 🔥 — continue !`
              : `${streak}-day streak 🔥 — keep it up!`,
          });
        }
      }

      const curTxs = (cur ?? []).filter((tx: any) => !isTransfer(tx));
      const prevTxs = (prev ?? []).filter((tx: any) => !isTransfer(tx));
      if (!curTxs.length) return result;

      // 1. Top expense (single transaction) — keep full description; CSS handles truncation, title shows full text.
      const top = [...curTxs].sort((a, b) => Number(b.amount) - Number(a.amount))[0];
      if (top) {
        const catName = categories.find(c => c.id === top.category_id)?.name;
        const desc = (top.description || '').trim();
        result.push({
          key: 'top',
          icon: <Crown className="w-3.5 h-3.5" />,
          tone: 'primary',
          text: locale === 'fr'
            ? `Top dépense · ${fmt(Number(top.amount))} — ${desc}${catName ? ` (${catName})` : ''}`
            : `Top spend · ${fmt(Number(top.amount))} — ${desc}${catName ? ` (${catName})` : ''}`,
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
      for (const tx of prevTxs) {
        if (!tx.category_id) continue;
        prevByCat.set(tx.category_id, (prevByCat.get(tx.category_id) || 0) + Number(tx.amount));
      }
      let worst: { id: string; pct: number; delta: number } | null = null;
      for (const [catId, curTotal] of byCat.entries()) {
        const prevTotal = prevByCat.get(catId) || 0;
        if (prevTotal < 5000) continue;
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

      return result.slice(0, 4);
    },
    enabled: !!userId && categories.length > 0,
    staleTime: 60_000,
  });

  if (!insights.length) return null;

  const toneClasses: Record<Insight['tone'], string> = {
    primary: 'bg-primary/10 border-primary/25 text-primary',
    warn: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
    info: 'bg-secondary/10 border-secondary/25 text-secondary',
    streak: 'bg-gradient-to-r from-orange-500/15 to-amber-500/15 border-orange-500/40 text-orange-600 dark:text-orange-400 shadow-[0_2px_12px_-2px_hsl(25_95%_55%/0.35)]',
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
            title={ins.text}
            className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-semibold backdrop-blur-sm transition-all cursor-help hover:max-w-none ${toneClasses[ins.tone]}`}
          >
            <span className="flex-shrink-0">{ins.icon}</span>
            <span className="truncate max-w-[220px] sm:max-w-[320px] md:max-w-[440px] lg:max-w-[560px] group-hover:max-w-[720px] transition-[max-width] duration-300">
              {ins.text}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
};
