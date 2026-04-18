import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, AlertTriangle, Lightbulb, X } from 'lucide-react';

interface Props {
  budgets: any[];
  spending: Record<string, number>;
  fmt: (n: number) => string;
  locale: 'fr' | 'en';
}

type Insight = {
  key: string;
  icon: React.ReactNode;
  tone: 'win' | 'warn' | 'coach';
  text: string;
};

/**
 * Coach Financier — client-side insight bar for the Budgets module.
 * Computes "best respected", "biggest overshoot" and "projected overshoot"
 * directly from budgets + spending. Dismissible per session.
 */
export const BudgetCoachInsights = ({ budgets, spending, fmt, locale }: Props) => {
  const isFr = locale === 'fr';
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const insights = useMemo<Insight[]>(() => {
    const result: Insight[] = [];
    const active = budgets.filter((b) => !b.paused_at && (b.control_type || 'max') === 'max');
    if (active.length === 0) return result;

    type Row = { b: any; pct: number; actual: number; amount: number };
    const rows: Row[] = active.map((b) => {
      const amount = Number(b.amount);
      const actual = spending[b.category_id || ''] || 0;
      const pct = amount > 0 ? (actual / amount) * 100 : 0;
      return { b, pct, actual, amount };
    });

    // 1) Best respected (lowest pct, > 0 spending)
    const respected = rows
      .filter((r) => r.pct > 0 && r.pct <= 90)
      .sort((a, b) => a.pct - b.pct)[0];
    if (respected) {
      const name = respected.b.categories?.name || respected.b.name;
      result.push({
        key: 'win',
        tone: 'win',
        icon: <Trophy className="w-3.5 h-3.5" />,
        text: isFr
          ? `🏆 ${name} : pile dans la cible (${Math.round(respected.pct)}%)`
          : `🏆 ${name}: right on target (${Math.round(respected.pct)}%)`,
      });
    }

    // 2) Biggest overshoot
    const overshoot = rows.filter((r) => r.pct > 100).sort((a, b) => b.pct - a.pct)[0];
    if (overshoot) {
      const name = overshoot.b.categories?.name || overshoot.b.name;
      const over = Math.round(overshoot.pct - 100);
      result.push({
        key: 'overshoot',
        tone: 'warn',
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
        text: isFr
          ? `⚠️ ${name} : +${over}% — pensez à ajuster`
          : `⚠️ ${name}: +${over}% — consider adjusting`,
      });
    }

    // 3) Projection — for monthly budgets, extrapolate based on day of month
    const now = new Date();
    const day = now.getDate();
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    if (day > 5 && day < dim) {
      const projected = rows
        .filter((r) => (r.b.period || 'monthly') === 'monthly' && r.pct > 0 && r.pct < 100)
        .map((r) => ({ ...r, projected: (r.actual / day) * dim }))
        .filter((r) => r.projected > r.amount)
        .sort((a, b) => b.projected - a.projected)[0];
      if (projected) {
        const name = projected.b.categories?.name || projected.b.name;
        const over = projected.projected - projected.amount;
        result.push({
          key: 'projection',
          tone: 'coach',
          icon: <Lightbulb className="w-3.5 h-3.5" />,
          text: isFr
            ? `💡 À ce rythme, ${name} dépassera de ${fmt(over)} fin du mois`
            : `💡 At this pace, ${name} will exceed by ${fmt(over)} end of month`,
        });
      }
    }

    return result.slice(0, 3);
  }, [budgets, spending, fmt, isFr]);

  const visible = insights.filter((i) => !dismissed.has(i.key));
  if (visible.length === 0) return null;

  const toneClass = (tone: Insight['tone']) =>
    tone === 'win'
      ? 'bg-secondary/10 text-secondary border-secondary/30 hover:bg-secondary/15'
      : tone === 'warn'
        ? 'bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/15'
        : 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/15';

  return (
    <div className="flex flex-wrap gap-2">
      <AnimatePresence>
        {visible.map((i) => (
          <motion.div
            key={i.key}
            initial={{ opacity: 0, scale: 0.9, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.25 }}
            className={`group inline-flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-full border text-xs font-semibold backdrop-blur-sm transition-colors ${toneClass(i.tone)}`}
          >
            {i.icon}
            <span className="truncate max-w-[260px] sm:max-w-none">{i.text}</span>
            <button
              type="button"
              onClick={() => setDismissed((s) => new Set(s).add(i.key))}
              className="opacity-50 hover:opacity-100 transition-opacity rounded-full"
              aria-label={isFr ? 'Masquer' : 'Dismiss'}
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
