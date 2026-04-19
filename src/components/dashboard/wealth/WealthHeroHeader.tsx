import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Gem, Plus, FileDown, FileSpreadsheet, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Button } from '@/components/ui/button';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { HeroHeaderShell } from '@/components/dashboard/HeroHeaderShell';

interface Valuation { asset_id: string; valued_at: string; value: number }

interface Props {
  isFr: boolean;
  fmt: (n: number) => string;
  netWorth: number;
  totalAssets: number;
  totalSavings: number;
  totalDebt: number;
  totalGainLoss: number;
  assetsCount: number;
  /** Optional asset valuations history to render a net-worth sparkline */
  valuations?: Valuation[];
  onAddAsset: () => void;
  onExportPDF: () => void;
  onExportExcel: () => void;
}

/**
 * Premium glass hero header for the Patrimoine module.
 * Displays net worth, asset/debt breakdown, a Coach Financier subtitle and an optional sparkline.
 */
export const WealthHeroHeader = ({
  isFr, fmt, netWorth, totalAssets, totalSavings, totalDebt, totalGainLoss, assetsCount,
  valuations = [], onAddAsset, onExportPDF, onExportExcel,
}: Props) => {
  const isPositive = totalGainLoss >= 0;

  const { debtRatio, coachMsg, sparkline } = useMemo(() => {
    const debtRatio = totalAssets + totalSavings > 0
      ? (totalDebt / (totalAssets + totalSavings)) * 100
      : 0;

    let coachMsg: string;
    if (assetsCount === 0 && totalSavings === 0 && totalDebt === 0) {
      coachMsg = isFr
        ? '🏛️ Bâtissez votre patrimoine — ajoutez votre premier actif'
        : '🏛️ Build your wealth — add your first asset';
    } else if (netWorth < 0) {
      coachMsg = isFr
        ? '⚠️ Patrimoine net négatif · priorité au remboursement des dettes'
        : '⚠️ Net worth is negative · prioritize paying down debts';
    } else if (debtRatio > 50) {
      coachMsg = isFr
        ? `🛟 Endettement élevé (${Math.round(debtRatio)}%) · réduisez progressivement`
        : `🛟 High leverage (${Math.round(debtRatio)}%) · scale debts down gradually`;
    } else if (totalGainLoss > 0) {
      coachMsg = isFr
        ? `📈 Plus-value de ${fmt(totalGainLoss)} sur vos actifs · belle valorisation !`
        : `📈 ${fmt(totalGainLoss)} gain on your assets · great appreciation!`;
    } else {
      coachMsg = isFr
        ? `🏛️ ${assetsCount} actif${assetsCount > 1 ? 's' : ''} suivi${assetsCount > 1 ? 's' : ''} · diversifiez pour sécuriser`
        : `🏛️ ${assetsCount} asset${assetsCount > 1 ? 's' : ''} tracked · diversify to secure`;
    }

    // Sparkline: somme des dernières valorisations agrégées par date (dernières 12 dates)
    let sparkline: { v: number }[] = [];
    if (valuations.length > 1) {
      const byDate: Record<string, number> = {};
      valuations.forEach(v => { byDate[v.valued_at] = (byDate[v.valued_at] || 0) + Number(v.value); });
      const sorted = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b));
      let running = 0;
      const points = sorted.map(([, total]) => { running = total; return { v: running }; });
      sparkline = points.slice(-12);
    }

    return { debtRatio, coachMsg, sparkline };
  }, [assetsCount, totalSavings, totalDebt, totalAssets, netWorth, totalGainLoss, valuations, isFr, fmt]);

  const sparkColor = isPositive ? 'hsl(165, 70%, 46%)' : 'hsl(0, 84%, 60%)';

  return (
    <HeroHeaderShell topBlobClassName="bg-primary/20" bottomBlobClassName="bg-secondary/15" innerClassName="p-5 sm:p-7">
      <div className="flex flex-col lg:flex-row lg:items-center gap-5">
        {/* Left — title + KPI */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-primary/30 to-secondary/20 flex items-center justify-center border border-primary/25">
              <Gem className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold font-display tracking-tight">
                {isFr ? 'Mon patrimoine' : 'My wealth'}
              </h2>
              <p className="text-[11px] text-muted-foreground/80 font-medium truncate">{coachMsg}</p>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex items-baseline gap-3 flex-wrap mt-3"
          >
            <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
              {isFr ? 'Valeur nette' : 'Net worth'}
            </span>
            <span className="text-3xl sm:text-5xl font-bold tracking-tight font-display tabular-nums">
              <AnimatedNumber value={netWorth} format={fmt} duration={0.8} />
            </span>
            {totalGainLoss !== 0 && (
              <div className={`flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded-full ${isPositive ? 'bg-secondary/15 text-secondary' : 'bg-destructive/15 text-destructive'}`}>
                {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {isPositive ? '+' : ''}{fmt(totalGainLoss)}
                <span className="text-[10px] opacity-75 font-normal">{isFr ? 'plus-value' : 'gain'}</span>
              </div>
            )}
          </motion.div>

          <div className="grid grid-cols-3 gap-2 mt-4 max-w-md">
            <div className="rounded-xl bg-secondary/10 border border-secondary/20 px-2.5 py-2">
              <div className="text-[9px] uppercase tracking-wider font-semibold text-secondary flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3" />{isFr ? 'Actifs' : 'Assets'}
              </div>
              <div className="text-xs sm:text-sm font-extrabold tabular-nums mt-0.5 truncate">
                {fmt(totalAssets + totalSavings)}
              </div>
            </div>
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 px-2.5 py-2">
              <div className="text-[9px] uppercase tracking-wider font-semibold text-destructive flex items-center gap-1">
                <ArrowDownRight className="w-3 h-3" />{isFr ? 'Dettes' : 'Debts'}
              </div>
              <div className="text-xs sm:text-sm font-extrabold tabular-nums mt-0.5 truncate">
                -{fmt(totalDebt)}
              </div>
            </div>
            <div className="rounded-xl bg-primary/10 border border-primary/20 px-2.5 py-2">
              <div className="text-[9px] uppercase tracking-wider font-semibold text-primary">
                {isFr ? 'Endettement' : 'Leverage'}
              </div>
              <div className="text-xs sm:text-sm font-extrabold tabular-nums mt-0.5">
                {Math.round(debtRatio)}%
              </div>
            </div>
          </div>

          {/* Sparkline patrimoine */}
          {sparkline.length > 1 && (
            <div className="h-12 mt-3 -mx-1 max-w-md">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkline}>
                  <defs>
                    <linearGradient id="wealthHeroSpark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={sparkColor} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="v" stroke={sparkColor} strokeWidth={2} fill="url(#wealthHeroSpark)" isAnimationActive />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Right — actions */}
        <div className="flex flex-col gap-2 w-full sm:w-auto shrink-0">
          <Button
            size="sm"
            onClick={onAddAsset}
            className="rounded-xl text-primary-foreground gap-1.5 shadow-md"
            style={{ background: 'var(--gradient-primary)' }}
          >
            <Plus className="w-4 h-4" />
            {isFr ? 'Ajouter un actif' : 'Add asset'}
          </Button>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onExportPDF} className="rounded-xl gap-1.5 flex-1 backdrop-blur-sm bg-background/60 border-border/60">
              <FileDown className="w-3.5 h-3.5" /> PDF
            </Button>
            <Button size="sm" variant="outline" onClick={onExportExcel} className="rounded-xl gap-1.5 flex-1 backdrop-blur-sm bg-background/60 border-border/60">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </Button>
          </div>
        </div>
      </div>
    </HeroHeaderShell>
  );
};
