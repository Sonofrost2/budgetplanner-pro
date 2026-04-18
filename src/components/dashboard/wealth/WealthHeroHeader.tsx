import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Gem, Plus, FileDown, FileSpreadsheet, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedNumber } from '@/components/ui/animated-number';

interface Props {
  isFr: boolean;
  fmt: (n: number) => string;
  netWorth: number;
  totalAssets: number;
  totalSavings: number;
  totalDebt: number;
  totalGainLoss: number;
  assetsCount: number;
  onAddAsset: () => void;
  onExportPDF: () => void;
  onExportExcel: () => void;
}

/**
 * Premium glass hero header for the Patrimoine module.
 * Displays net worth, asset/debt breakdown and a Coach Financier subtitle.
 */
export const WealthHeroHeader = ({
  isFr, fmt, netWorth, totalAssets, totalSavings, totalDebt, totalGainLoss, assetsCount,
  onAddAsset, onExportPDF, onExportExcel,
}: Props) => {
  const isPositive = totalGainLoss >= 0;
  const debtRatio = totalAssets + totalSavings > 0
    ? (totalDebt / (totalAssets + totalSavings)) * 100
    : 0;

  const coachMsg = useMemo(() => {
    if (assetsCount === 0 && totalSavings === 0 && totalDebt === 0) {
      return isFr
        ? '🏛️ Bâtissez votre patrimoine — ajoutez votre premier actif'
        : '🏛️ Build your wealth — add your first asset';
    }
    if (netWorth < 0) {
      return isFr
        ? '⚠️ Patrimoine net négatif · priorité au remboursement des dettes'
        : '⚠️ Net worth is negative · prioritize paying down debts';
    }
    if (debtRatio > 50) {
      return isFr
        ? `🛟 Endettement élevé (${Math.round(debtRatio)}%) · réduisez progressivement`
        : `🛟 High leverage (${Math.round(debtRatio)}%) · scale debts down gradually`;
    }
    if (totalGainLoss > 0) {
      return isFr
        ? `📈 Plus-value de ${fmt(totalGainLoss)} sur vos actifs · belle valorisation !`
        : `📈 ${fmt(totalGainLoss)} gain on your assets · great appreciation!`;
    }
    return isFr
      ? `🏛️ ${assetsCount} actif${assetsCount > 1 ? 's' : ''} suivi${assetsCount > 1 ? 's' : ''} · diversifiez pour sécuriser`
      : `🏛️ ${assetsCount} asset${assetsCount > 1 ? 's' : ''} tracked · diversify to secure`;
  }, [assetsCount, totalSavings, totalDebt, netWorth, debtRatio, totalGainLoss, isFr, fmt]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-3xl border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass))] backdrop-blur-xl shadow-[var(--shadow-glass)]"
    >
      {/* decorative blobs */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-secondary/15 blur-3xl" />

      <div className="relative p-5 sm:p-7">
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
      </div>
    </motion.div>
  );
};
