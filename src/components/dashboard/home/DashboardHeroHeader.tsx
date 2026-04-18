import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, LayoutGrid, Check, Plus, RotateCcw, CalendarRange, Zap, Loader2, X, Wallet, TrendingUp, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { DashTranslations } from '@/i18n/dashTranslations';
import type { QuickParsedTransaction } from '@/components/dashboard/transactions/TransactionsHeroHeader';

type PeriodKey = 'today' | 'thisWeek' | 'thisMonth' | 'thisQuarter' | 'thisSemester' | 'thisYear' | 'custom';

interface Props {
  locale: 'fr' | 'en';
  t: DashTranslations;
  fmt: (n: number) => string;
  totalBalance: number;
  netCashFlow: number;
  savingsRate: number;
  dailyBalanceData: number[];
  period: PeriodKey;
  onPeriodChange: (p: PeriodKey) => void;
  customStart: string;
  customEnd: string;
  setCustomStart: (v: string) => void;
  setCustomEnd: (v: string) => void;
  appliedCustom: { start: string; end: string } | null;
  onApplyCustom: () => void;
  customOpen: boolean;
  setCustomOpen: (v: boolean) => void;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  resetLayout: () => void;
  onAddTransaction: () => void;
  onQuickAdd?: (parsed: QuickParsedTransaction) => void;
}

const PERIODS: PeriodKey[] = ['today', 'thisWeek', 'thisMonth', 'thisQuarter', 'thisYear'];

export const DashboardHeroHeader = ({
  locale, t, fmt,
  totalBalance, netCashFlow, savingsRate, dailyBalanceData,
  period, onPeriodChange,
  customStart, customEnd, setCustomStart, setCustomEnd,
  appliedCustom, onApplyCustom, customOpen, setCustomOpen,
  editMode, setEditMode, resetLayout,
  onAddTransaction, onQuickAdd,
}: Props) => {
  const isFr = locale === 'fr';
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickInput, setQuickInput] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);

  const today = useMemo(() => {
    return new Date().toLocaleDateString(isFr ? 'fr-FR' : 'en-US', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
  }, [isFr]);

  // Sparkline path
  const sparkPath = useMemo(() => {
    if (!dailyBalanceData?.length || dailyBalanceData.length < 2) return '';
    const min = Math.min(...dailyBalanceData, 0);
    const max = Math.max(...dailyBalanceData, 1);
    const range = max - min || 1;
    const w = 200, h = 36;
    return dailyBalanceData.map((v, i) => {
      const x = (i / (dailyBalanceData.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }, [dailyBalanceData]);

  const handleQuickParse = async () => {
    const text = quickInput.trim();
    if (!text || quickLoading || !onQuickAdd) return;
    setQuickLoading(true);
    try {
      const [{ data: cats }, { data: accs }] = await Promise.all([
        supabase.from('categories').select('id, name, type').is('deleted_at', null),
        supabase.from('payment_accounts').select('id, name').is('deleted_at', null).eq('status', 'active'),
      ]);
      const { data, error } = await supabase.functions.invoke('ai-quick-parse', {
        body: { input: text, categories: cats || [], accounts: accs || [], locale },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.description || typeof data.amount !== 'number') {
        throw new Error(isFr ? 'Saisie non comprise' : 'Could not parse input');
      }
      onQuickAdd(data as QuickParsedTransaction);
      setQuickInput('');
      setQuickOpen(false);
      toast.success(isFr ? '✨ Transaction pré-remplie' : '✨ Transaction pre-filled');
    } catch (e: any) {
      toast.error(e?.message || (isFr ? 'Erreur IA' : 'AI error'));
    } finally {
      setQuickLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-3xl border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass))] backdrop-blur-xl shadow-[var(--shadow-glass)]"
    >
      {/* Decorative gradient blobs */}
      <div className="pointer-events-none absolute -top-32 -right-24 w-96 h-96 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-secondary/15 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)', backgroundSize: '20px 20px' }} />

      <div className="relative px-5 sm:px-7 py-5 sm:py-6 space-y-5">
        {/* Top row: greeting + actions */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-primary/30 to-secondary/20 flex items-center justify-center border border-primary/25">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-display font-bold leading-tight truncate">
                  {t.dashboard}
                </h1>
                <p className="text-[11px] text-muted-foreground/80 font-medium capitalize">
                  {today}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {onQuickAdd && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setQuickOpen(v => !v)}
                className={`h-9 rounded-xl border-primary/40 bg-primary/10 hover:bg-primary/15 text-primary text-xs gap-1.5 ${quickOpen ? 'ring-2 ring-primary/30' : ''}`}
              >
                <Zap className="w-3.5 h-3.5" />
                {t.quickAdd}
              </Button>
            )}
            <Button
              variant={editMode ? 'default' : 'outline'}
              size="sm"
              className={`h-9 rounded-xl text-xs gap-1.5 ${editMode ? '' : 'glass border-glass-border'}`}
              style={editMode ? { background: 'var(--gradient-primary)' } : undefined}
              onClick={() => setEditMode(!editMode)}
            >
              {editMode ? <Check className="w-3.5 h-3.5" /> : <LayoutGrid className="w-3.5 h-3.5" />}
              {editMode ? (isFr ? 'Terminé' : 'Done') : ''}
            </Button>
            <Button
              size="sm"
              className="h-9 rounded-xl text-primary-foreground btn-glow-primary px-4 text-xs gap-1.5"
              style={{ background: 'var(--gradient-primary)' }}
              onClick={onAddTransaction}
            >
              <Plus className="w-3.5 h-3.5" />
              {t.addTransaction}
            </Button>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Balance */}
          <div className="rounded-2xl border border-primary/25 bg-primary/8 px-3.5 py-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary uppercase tracking-wider">
              <Wallet className="w-3 h-3" />{t.totalBalance}
            </div>
            <div className="text-lg sm:text-xl font-extrabold text-primary tabular-nums mt-1 leading-none">
              <AnimatedNumber value={totalBalance} format={fmt} duration={0.6} />
            </div>
            {sparkPath && (
              <svg viewBox="0 0 200 36" className="w-full h-6 mt-1.5" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="dashHeroSpark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={`${sparkPath} L 200,36 L 0,36 Z`} fill="url(#dashHeroSpark)" />
                <path d={sparkPath} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>

          {/* Cash flow */}
          <div className={`rounded-2xl border px-3.5 py-3 ${netCashFlow >= 0 ? 'border-secondary/25 bg-secondary/8' : 'border-destructive/25 bg-destructive/8'}`}>
            <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${netCashFlow >= 0 ? 'text-secondary' : 'text-destructive'}`}>
              <TrendingUp className="w-3 h-3" />{isFr ? 'Cash-flow' : 'Cash flow'}
            </div>
            <div className={`text-lg sm:text-xl font-extrabold tabular-nums mt-1 leading-none ${netCashFlow >= 0 ? 'text-secondary' : 'text-destructive'}`}>
              {netCashFlow >= 0 ? '+' : '−'}<AnimatedNumber value={Math.abs(netCashFlow)} format={fmt} duration={0.6} />
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-1">{isFr ? 'sur la période' : 'over the period'}</p>
          </div>

          {/* Savings rate */}
          <div className={`rounded-2xl border px-3.5 py-3 ${savingsRate >= 0 ? 'border-accent/25 bg-accent/8' : 'border-destructive/25 bg-destructive/8'}`}>
            <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${savingsRate >= 0 ? 'text-accent' : 'text-destructive'}`}>
              <Percent className="w-3 h-3" />{isFr ? "Taux d'épargne" : 'Savings rate'}
            </div>
            <div className={`text-lg sm:text-xl font-extrabold tabular-nums mt-1 leading-none ${savingsRate >= 0 ? 'text-accent' : 'text-destructive'}`}>
              {savingsRate.toFixed(0)}%
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-1">{isFr ? 'revenus → épargne' : 'income → savings'}</p>
          </div>
        </div>

        {/* Period chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              className={`h-7 px-3 rounded-full text-[11px] font-semibold transition-all ${
                period === p
                  ? 'text-primary-foreground shadow-md scale-[1.02]'
                  : 'glass border border-glass-border text-muted-foreground hover:text-foreground hover:scale-[1.02]'
              }`}
              style={period === p ? { background: 'var(--gradient-primary)' } : undefined}
            >
              {(t as any)[p]}
            </button>
          ))}
          <Popover open={customOpen} onOpenChange={setCustomOpen}>
            <PopoverTrigger asChild>
              <button
                onClick={() => { onPeriodChange('custom'); setCustomOpen(true); }}
                className={`h-7 px-3 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 transition-all ${
                  period === 'custom'
                    ? 'text-primary-foreground shadow-md'
                    : 'glass border border-glass-border text-muted-foreground hover:text-foreground'
                }`}
                style={period === 'custom' ? { background: 'var(--gradient-primary)' } : undefined}
              >
                <CalendarRange className="w-3 h-3" />
                {appliedCustom
                  ? `${new Date(appliedCustom.start).toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })} → ${new Date(appliedCustom.end).toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}`
                  : t.customPeriod}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-4 space-y-3" align="end">
              <div className="space-y-2">
                <Label className="text-xs">{t.from}</Label>
                <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{t.to}</Label>
                <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-8 text-xs" />
              </div>
              <Button size="sm" className="w-full" onClick={onApplyCustom} disabled={!customStart || !customEnd}>{t.apply}</Button>
            </PopoverContent>
          </Popover>
          {editMode && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[10px] gap-1 text-muted-foreground hover:text-foreground ml-auto"
              onClick={resetLayout}
            >
              <RotateCcw className="w-3 h-3" />
              {isFr ? 'Réinitialiser' : 'Reset'}
            </Button>
          )}
        </div>
      </div>

      {/* Quick-Add inline panel */}
      <AnimatePresence initial={false}>
        {quickOpen && onQuickAdd && (
          <motion.div
            key="dash-quick-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative border-t border-[hsl(var(--glass-border))] bg-gradient-to-r from-primary/8 via-transparent to-secondary/8 backdrop-blur-sm overflow-hidden"
          >
            <div className="px-5 sm:px-7 py-3 flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0 shadow-md">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </div>
              <Input
                autoFocus
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); handleQuickParse(); }
                  if (e.key === 'Escape') { setQuickOpen(false); setQuickInput(''); }
                }}
                placeholder={isFr ? 'Ex: Café 1500, Taxi 3k, Salaire 250000…' : 'e.g. Coffee 1500, Taxi 3k, Salary 250000…'}
                disabled={quickLoading}
                maxLength={500}
                className="h-9 rounded-xl bg-background/70 border-primary/25 focus-visible:ring-primary/40 text-sm flex-1 min-w-0"
              />
              <Button
                size="sm"
                onClick={handleQuickParse}
                disabled={!quickInput.trim() || quickLoading}
                className="h-9 rounded-xl text-primary-foreground shrink-0"
                style={{ background: 'var(--gradient-primary)' }}
              >
                {quickLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => { setQuickOpen(false); setQuickInput(''); }}
                className="h-9 w-9 rounded-xl shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
