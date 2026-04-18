import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Sparkles, Target, AlertTriangle, Wallet, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { SavingsRingProgress } from '@/components/dashboard/savings/SavingsRingProgress';
import type { DashTranslations } from '@/i18n/dashTranslations';

interface Props {
  budgets: any[];
  spending: Record<string, number>;
  fmt: (n: number) => string;
  locale: 'fr' | 'en';
  t: DashTranslations;
  onAddNew: () => void;
  onAiSuggest: () => void;
  aiLoading: boolean;
  onAlertClick?: () => void;
}

/**
 * Premium glassmorphism hero header for the Budgets module.
 * Displays animated KPIs (total period budget, consumed, remaining, % global),
 * a "Budget health" ring, and an alerts badge.
 */
export const BudgetsHeroHeader = ({
  budgets, spending, fmt, locale, t, onAddNew, onAiSuggest, aiLoading, onAlertClick,
}: Props) => {
  const isFr = locale === 'fr';

  const stats = useMemo(() => {
    let totalBudget = 0;
    let totalConsumed = 0;
    let alertCount = 0;
    let respectedCount = 0;
    const activeBudgets = budgets.filter((b) => !b.paused_at);

    for (const b of activeBudgets) {
      const amount = Number(b.amount);
      const actual = spending[b.category_id || ''] || 0;
      const isMax = (b.control_type || 'max') === 'max';
      const threshold = b.alert_threshold ?? 80;
      const pct = amount > 0 ? (actual / amount) * 100 : 0;

      totalBudget += amount;
      totalConsumed += actual;

      if (isMax) {
        if (actual > amount) alertCount++;
        else if (pct >= threshold) alertCount++;
        else respectedCount++;
      } else {
        if (actual < amount) alertCount++;
        else respectedCount++;
      }
    }

    const remaining = Math.max(totalBudget - totalConsumed, 0);
    const globalPct = totalBudget > 0 ? Math.round((totalConsumed / totalBudget) * 100) : 0;
    const total = activeBudgets.length;
    const healthScore = total > 0 ? Math.round((respectedCount / total) * 100) : 100;

    return { totalBudget, totalConsumed, remaining, globalPct, alertCount, healthScore, total };
  }, [budgets, spending]);

  const ringTone: 'emerald' | 'primary' | 'destructive' =
    stats.healthScore >= 75 ? 'emerald' : stats.healthScore >= 50 ? 'primary' : 'destructive';

  const coachMsg = useMemo(() => {
    if (stats.total === 0) {
      return isFr
        ? 'Pas de cadre ? Donnez une direction à vos dépenses 🧭'
        : 'No budget yet? Give your spending a clear direction 🧭';
    }
    if (stats.healthScore >= 80) {
      return isFr
        ? '🎯 Excellent ! Vos cadres sont respectés.'
        : '🎯 Excellent! Your budgets are on track.';
    }
    if (stats.healthScore >= 50) {
      return isFr
        ? '👀 Quelques ajustements à prévoir.'
        : '👀 A few adjustments needed.';
    }
    return isFr
      ? '⚠️ Plusieurs cadres dépassés — révisons ensemble.'
      : '⚠️ Several budgets exceeded — let\'s review together.';
  }, [stats, isFr]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-3xl border border-border/40 shadow-[var(--shadow-card)] bg-gradient-to-br from-primary/15 via-background to-accent/15 backdrop-blur-xl"
    >
      {/* decorative blobs */}
      <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-accent/20 blur-3xl" />

      <div className="relative p-5 sm:p-6 lg:p-7">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          {/* Left — title + KPIs */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                <Target className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold font-display tracking-tight">
                  {isFr ? 'Mes cadres de dépense' : 'My spending budgets'}
                </h2>
                <p className="text-[11px] text-muted-foreground">{coachMsg}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <KpiTile
                icon={<Wallet className="w-3.5 h-3.5" />}
                tone="primary"
                label={isFr ? 'Total cadre' : 'Total budget'}
                value={<AnimatedNumber value={stats.totalBudget} format={fmt} className="text-base sm:text-lg font-extrabold text-foreground" />}
              />
              <KpiTile
                icon={<TrendingUp className="w-3.5 h-3.5" />}
                tone="accent"
                label={isFr ? 'Déjà dépensé' : 'Already spent'}
                value={<AnimatedNumber value={stats.totalConsumed} format={fmt} className="text-base sm:text-lg font-extrabold text-foreground" />}
              />
              <KpiTile
                icon={<Wallet className="w-3.5 h-3.5" />}
                tone="emerald"
                label={isFr ? 'Reste' : 'Remaining'}
                value={<AnimatedNumber value={stats.remaining} format={fmt} className="text-base sm:text-lg font-extrabold text-foreground" />}
              />
              <KpiTile
                icon={<Target className="w-3.5 h-3.5" />}
                tone={stats.globalPct > 100 ? 'destructive' : stats.globalPct >= 80 ? 'accent' : 'emerald'}
                label={isFr ? 'Global' : 'Global'}
                value={<span className="text-base sm:text-lg font-extrabold tabular-nums">{stats.globalPct}%</span>}
              />
            </div>

            {stats.alertCount > 0 && (
              <button
                type="button"
                onClick={onAlertClick}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 text-[11px] font-semibold hover:bg-destructive/15 transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                {stats.alertCount} {isFr ? 'cadre(s) en alerte' : 'budget(s) in alert'}
              </button>
            )}
          </div>

          {/* Right — health ring + actions */}
          <div className="flex sm:flex-row lg:flex-col items-center gap-4">
            <SavingsRingProgress value={stats.healthScore} size={104} strokeWidth={8} tone={ringTone}>
              <div className="text-center">
                <div className="text-2xl font-extrabold tabular-nums">{stats.healthScore}</div>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {isFr ? 'Santé' : 'Health'}
                </div>
              </div>
            </SavingsRingProgress>

            <div className="flex flex-col gap-2 w-full sm:w-auto">
              <Button
                size="sm"
                onClick={onAddNew}
                className="rounded-xl text-primary-foreground gap-1.5 shadow-md"
                style={{ background: 'var(--gradient-primary)' }}
              >
                <Plus className="w-4 h-4" />
                {isFr ? 'Nouveau cadre' : 'New budget'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onAiSuggest}
                disabled={aiLoading}
                className="rounded-xl gap-1.5 backdrop-blur-sm bg-background/60 border-border/60"
              >
                <Sparkles className="w-4 h-4 text-primary" />
                {t.aiBudgetSuggest}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

function KpiTile({
  icon, tone, label, value,
}: {
  icon: React.ReactNode;
  tone: 'primary' | 'accent' | 'emerald' | 'destructive';
  label: string;
  value: React.ReactNode;
}) {
  const toneClass = {
    primary: 'bg-primary/10 text-primary',
    accent: 'bg-accent/15 text-accent-foreground',
    emerald: 'bg-secondary/15 text-secondary',
    destructive: 'bg-destructive/10 text-destructive',
  }[tone];
  return (
    <div className="rounded-2xl bg-background/50 backdrop-blur-sm border border-border/40 p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${toneClass}`}>
          {icon}
        </div>
        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground truncate">
          {label}
        </span>
      </div>
      <div>{value}</div>
    </div>
  );
}
