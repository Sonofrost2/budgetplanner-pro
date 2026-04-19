import { useMemo } from 'react';
import { BarChart3, Download, Lock, Sparkles, TrendingUp, TrendingDown } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Button } from '@/components/ui/button';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { HeroHeaderShell } from '@/components/dashboard/HeroHeaderShell';

interface SeriesPoint { v: number }

interface Props {
  isFr: boolean;
  fmt: (n: number) => string;
  totalIncome: number;
  totalExpense: number;
  txCount: number;
  periodLabel: string;
  /** 30-day surplus sparkline series (income - expense par jour) */
  sparkline?: SeriesPoint[];
  canExportAdvanced: boolean;
  onExportCSV: () => void;
  onExportExcel: () => void;
}

/**
 * Glass hero header for the Reports module — Coach Financier style with KPI snapshot.
 * All derived values (surplus, savingsRate, coachMsg) are computed in a single useMemo.
 */
export const ReportsHeroHeader = ({
  isFr, fmt, totalIncome, totalExpense, txCount, periodLabel, sparkline = [],
  canExportAdvanced, onExportCSV, onExportExcel,
}: Props) => {
  const { surplus, savingsRate, isPositive, coachMsg } = useMemo(() => {
    const surplus = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? Math.round((surplus / totalIncome) * 100) : 0;
    const isPositive = surplus >= 0;
    let coachMsg: string;
    if (txCount === 0) {
      coachMsg = isFr
        ? '📊 Aucune donnée à analyser sur cette période — élargissez le filtre'
        : '📊 No data to analyze on this period — broaden the filter';
    } else if (surplus < 0) {
      coachMsg = isFr
        ? `⚠️ Déficit de ${fmt(Math.abs(surplus))} · ${periodLabel}`
        : `⚠️ Deficit of ${fmt(Math.abs(surplus))} · ${periodLabel}`;
    } else if (savingsRate >= 20) {
      coachMsg = isFr
        ? `🎯 Excellent taux d'épargne (${savingsRate}%) · ${periodLabel}`
        : `🎯 Excellent savings rate (${savingsRate}%) · ${periodLabel}`;
    } else {
      coachMsg = isFr
        ? `📈 Surplus de ${fmt(surplus)} (${savingsRate}%) · ${periodLabel}`
        : `📈 Surplus of ${fmt(surplus)} (${savingsRate}%) · ${periodLabel}`;
    }
    return { surplus, savingsRate, isPositive, coachMsg };
  }, [totalIncome, totalExpense, txCount, periodLabel, isFr, fmt]);

  const sparkColor = isPositive ? 'hsl(165, 70%, 46%)' : 'hsl(0, 84%, 60%)';

  return (
    <HeroHeaderShell>
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
            <div className={`rounded-2xl p-3 border ${isPositive ? 'bg-primary/10 border-primary/20' : 'bg-destructive/10 border-destructive/20'}`}>
              <div className={`text-[10px] font-semibold uppercase tracking-wide ${isPositive ? 'text-primary' : 'text-destructive'}`}>
                {isFr ? 'Surplus' : 'Surplus'}
              </div>
              <div className="text-base sm:text-lg font-extrabold tabular-nums mt-1 truncate">
                <AnimatedNumber value={surplus} format={fmt} duration={0.6} />
              </div>
            </div>
          </div>

          {/* Sparkline (30j surplus quotidien) */}
          {sparkline.length > 1 && (
            <div className="h-12 mt-3 -mx-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkline}>
                  <defs>
                    <linearGradient id="reportsSpark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={sparkColor} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="v" stroke={sparkColor} strokeWidth={2} fill="url(#reportsSpark)" isAnimationActive />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground mt-2">
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
    </HeroHeaderShell>
  );
};
