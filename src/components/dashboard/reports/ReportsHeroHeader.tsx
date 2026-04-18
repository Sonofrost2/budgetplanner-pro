import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Download, Lock, Sparkles, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedNumber } from '@/components/ui/animated-number';

interface Props {
  isFr: boolean;
  fmt: (n: number) => string;
  totalIncome: number;
  totalExpense: number;
  txCount: number;
  periodLabel: string;
  canExportAdvanced: boolean;
  onExportCSV: () => void;
  onExportExcel: () => void;
}

/**
 * Glass hero header for the Reports module — Coach Financier style with KPI snapshot.
 */
export const ReportsHeroHeader = ({
  isFr, fmt, totalIncome, totalExpense, txCount, periodLabel,
  canExportAdvanced, onExportCSV, onExportExcel,
}: Props) => {
  const surplus = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.round((surplus / totalIncome) * 100) : 0;

  const coachMsg = useMemo(() => {
    if (txCount === 0) {
      return isFr
        ? '📊 Aucune donnée à analyser sur cette période — élargissez le filtre'
        : '📊 No data to analyze on this period — broaden the filter';
    }
    if (surplus < 0) {
      return isFr
        ? `⚠️ Déficit de ${fmt(Math.abs(surplus))} · ${periodLabel}`
        : `⚠️ Deficit of ${fmt(Math.abs(surplus))} · ${periodLabel}`;
    }
    if (savingsRate >= 20) {
      return isFr
        ? `🎯 Excellent taux d'épargne (${savingsRate}%) · ${periodLabel}`
        : `🎯 Excellent savings rate (${savingsRate}%) · ${periodLabel}`;
    }
    return isFr
      ? `📈 Surplus de ${fmt(surplus)} (${savingsRate}%) · ${periodLabel}`
      : `📈 Surplus of ${fmt(surplus)} (${savingsRate}%) · ${periodLabel}`;
  }, [txCount, surplus, savingsRate, periodLabel, isFr, fmt]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-3xl border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass))] backdrop-blur-xl shadow-[var(--shadow-glass)]"
    >
      <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 w-72 h-72 rounded-full bg-accent/15 blur-3xl" />

      <div className="relative p-5 sm:p-6 lg:p-7">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          {/* Left — title + KPIs */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center border border-primary/25">
                <BarChart3 className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold font-display tracking-tight">
                  {isFr ? 'Rapports & analyses' : 'Reports & analytics'}
                </h2>
                <p className="text-[11px] text-muted-foreground/80 font-medium truncate">{coachMsg}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4 max-w-xl">
              <div className="rounded-2xl bg-secondary/10 border border-secondary/20 p-3">
                <div className="flex items-center gap-1 text-[10px] font-semibold text-secondary uppercase tracking-wide">
                  <TrendingUp className="w-3 h-3" />{isFr ? 'Revenus' : 'Income'}
                </div>
                <div className="text-base sm:text-lg font-extrabold text-secondary tabular-nums mt-1 truncate">
                  <AnimatedNumber value={totalIncome} format={fmt} duration={0.6} />
                </div>
              </div>
              <div className="rounded-2xl bg-destructive/10 border border-destructive/20 p-3">
                <div className="flex items-center gap-1 text-[10px] font-semibold text-destructive uppercase tracking-wide">
                  <TrendingDown className="w-3 h-3" />{isFr ? 'Dépenses' : 'Expenses'}
                </div>
                <div className="text-base sm:text-lg font-extrabold text-destructive tabular-nums mt-1 truncate">
                  <AnimatedNumber value={totalExpense} format={fmt} duration={0.6} />
                </div>
              </div>
              <div className={`rounded-2xl p-3 border ${surplus >= 0 ? 'bg-primary/10 border-primary/20' : 'bg-destructive/10 border-destructive/20'}`}>
                <div className={`text-[10px] font-semibold uppercase tracking-wide ${surplus >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  {isFr ? 'Surplus' : 'Surplus'}
                </div>
                <div className="text-base sm:text-lg font-extrabold tabular-nums mt-1 truncate">
                  <AnimatedNumber value={surplus} format={fmt} duration={0.6} />
                </div>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground mt-3">
              {txCount} {isFr ? 'transaction(s) analysée(s)' : 'transaction(s) analyzed'}
            </p>
          </div>

          {/* Right — exports */}
          <div className="flex flex-col gap-2 w-full sm:w-auto shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={onExportCSV}
              disabled={!canExportAdvanced}
              className="rounded-xl gap-1.5 backdrop-blur-sm bg-background/60 border-border/60"
            >
              {!canExportAdvanced ? <Lock className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
              CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onExportExcel}
              disabled={!canExportAdvanced}
              className="rounded-xl gap-1.5 backdrop-blur-sm bg-background/60 border-border/60"
            >
              {!canExportAdvanced ? <Lock className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
              Excel
            </Button>
            {!canExportAdvanced && (
              <span className="text-[9px] text-muted-foreground text-center inline-flex items-center justify-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                {isFr ? 'Premium' : 'Premium'}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
