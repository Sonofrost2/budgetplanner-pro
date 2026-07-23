import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { Tags, Plus, Sparkles, Layers, FlaskConical, ShieldCheck, GitBranch, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { HeroHeaderShell } from '@/components/dashboard/HeroHeaderShell';
import type { CategoryStats } from '@/lib/categoryAnalytics';
import { computeCategoryMetrics, computeTaxonomyScore } from '@/lib/categoryAnalytics';
import type { Category } from '@/hooks/useDashboardData';

interface Props {
  categories: Category[];
  stats: Record<string, CategoryStats>;
  onCreate: () => void;
  onOpenTemplates: () => void;
  isFr: boolean;
}

export const CategoriesHeroHeader = ({ categories, stats, onCreate, onOpenTemplates, isFr }: Props) => {
  const kpis = useMemo(() => {
    // "Actives" = non-archived categories. Header text and KpiCard must use the same source.
    const activeCats = categories.filter(c => !(c as any).deleted_at && !(c as any).archived_at);
    const active = activeCats.length;
    let unused = 0;
    let topName = '—';
    let topIcon = '📁';
    let topPct = 0;
    let totalExpense = 0;
    const expenseTotals: { name: string; icon: string; total: number }[] = [];

    activeCats.forEach(c => {
      const s = stats[c.id];
      const total = s?.total_amount ?? 0;
      const count = s?.transaction_count ?? 0;
      if (count === 0) unused++;
      if (c.type === 'expense' && total > 0) {
        totalExpense += total;
        expenseTotals.push({ name: c.name, icon: c.icon, total });
      }
    });

    expenseTotals.sort((a, b) => b.total - a.total);
    if (expenseTotals[0] && totalExpense > 0) {
      topName = expenseTotals[0].name;
      topIcon = expenseTotals[0].icon;
      topPct = Math.round((expenseTotals[0].total / totalExpense) * 100);
    }

    // Sparkline = sum of top-5 expense series across last 6 months
    const top5 = expenseTotals.slice(0, 5);
    const series = Array.from({ length: 6 }, (_, i) => {
      let sum = 0;
      top5.forEach(t => {
        const cat = categories.find(c => c.name === t.name);
        const arr = cat ? stats[cat.id]?.monthly_series ?? [] : [];
        const padded = arr.slice(-6);
        const idx = padded.length - 6 + i;
        if (idx >= 0 && padded[idx]) sum += Number(padded[idx].total) || 0;
      });
      return sum;
    });

    // Hierarchy metrics + taxonomy score
    const roots = activeCats.filter(c => !c.parent_category_id).length;
    const withParent = activeCats.length - roots;
    const maxDepth = activeCats.reduce((max, c) => {
      let d = 1;
      let cur: Category | undefined = c;
      let hops = 0;
      const byId = new Map(activeCats.map(x => [x.id, x] as const));
      while (cur?.parent_category_id && hops < 10) {
        d += 1;
        cur = byId.get(cur.parent_category_id);
        hops += 1;
      }
      return Math.max(max, d);
    }, 1);

    const metrics = computeCategoryMetrics(
      activeCats,
      stats,
      new Set(), // Hero has no budget knowledge; score without budget penalty
      new Map(),
    );
    const { score } = computeTaxonomyScore(activeCats, metrics);

    return { active, unused, topName, topIcon, topPct, series, withParent, maxDepth, score };
  }, [categories, stats]);

  const max = Math.max(...kpis.series, 1);
  const points = kpis.series.map((v, i) => `${(i / 5) * 100},${100 - (v / max) * 90 - 5}`).join(' ');

  const scoreColor = kpis.score >= 80 ? 'text-emerald-500' : kpis.score >= 60 ? 'text-amber-500' : 'text-destructive';
  const scoreLabel = kpis.score >= 80
    ? (isFr ? 'Excellent' : 'Excellent')
    : kpis.score >= 60
      ? (isFr ? 'Correct' : 'OK')
      : (isFr ? 'À améliorer' : 'Needs work');

  return (
    <HeroHeaderShell>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div className="flex items-start gap-4">
          <motion.div
            initial={{ scale: 0.85, rotate: -5 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 16 }}
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-[var(--shadow-glass)]"
            style={{ background: 'var(--gradient-primary)' }}
          >
            <Tags className="w-7 h-7 text-primary-foreground" />
          </motion.div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight">
              {isFr ? 'Catégories' : 'Categories'}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5 max-w-md">
              {isFr
                ? `🎯 ${kpis.active} actives · top : ${kpis.topIcon} ${kpis.topName} (${kpis.topPct}%)`
                : `🎯 ${kpis.active} active · top: ${kpis.topIcon} ${kpis.topName} (${kpis.topPct}%)`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={onOpenTemplates}>
            <FlaskConical className="w-4 h-4" />
            {isFr ? 'Templates' : 'Templates'}
          </Button>
          <Button
            size="sm"
            className="text-primary-foreground rounded-xl gap-1.5"
            style={{ background: 'var(--gradient-primary)' }}
            onClick={onCreate}
          >
            <Plus className="w-4 h-4" />
            {isFr ? 'Nouvelle' : 'New'}
          </Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={<Layers className="w-4 h-4" />} label={isFr ? 'Actives' : 'Active'} value={kpis.active} />
        <KpiCard icon={<GitBranch className="w-4 h-4" />} label={isFr ? 'Hiérarchie' : 'Hierarchy'} value={kpis.maxDepth} suffix={isFr ? ' niv.' : ' lvl'} />
        <KpiCard icon={<Tags className="w-4 h-4" />} label={isFr ? 'Sous-cat.' : 'Sub-cats'} value={kpis.withParent} />
        <KpiCard icon={<Sparkles className="w-4 h-4" />} label={isFr ? 'Top dépense' : 'Top expense'} value={kpis.topPct} suffix="%" />
        <KpiCard icon={<AlertTriangle className="w-4 h-4" />} label={isFr ? 'Inutilisées' : 'Unused'} value={kpis.unused} accent={kpis.unused > 0} />
        <div className={`rounded-2xl border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass))]/40 p-3`}>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="w-3.5 h-3.5" />
            {isFr ? 'Score taxonomie' : 'Taxonomy score'}
          </div>
          <div className={`mt-1 text-2xl font-bold font-display tabular-nums ${scoreColor}`}>
            <AnimatedNumber value={kpis.score} />
            <span className="text-base text-muted-foreground ml-0.5">/100</span>
          </div>
          <p className={`text-[10px] mt-0.5 ${scoreColor}`}>{scoreLabel}</p>
        </div>
        <div className="rounded-2xl border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass))]/40 p-3 flex flex-col justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="w-3.5 h-3.5" />
            {isFr ? 'Top 5 · 6m' : 'Top 5 · 6m'}
          </div>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-10 mt-1">
            <polyline fill="none" stroke="hsl(var(--primary))" strokeWidth="2" points={points} />
          </svg>
        </div>
      </div>
    </HeroHeaderShell>
  );
};

const KpiCard = ({ icon, label, value, suffix, accent }: { icon: React.ReactNode; label: string; value: number; suffix?: string; accent?: boolean }) => (
  <div className={`rounded-2xl border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass))]/40 p-3 ${accent ? 'ring-1 ring-amber-500/30' : ''}`}>
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
    <div className="mt-1 text-2xl font-bold font-display tabular-nums">
      <AnimatedNumber value={value} />
      {suffix && <span className="text-base text-muted-foreground ml-0.5">{suffix}</span>}
    </div>
  </div>
);
