import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ArrowLeftRight, TrendingUp, TrendingDown, Wallet, Sparkles, Zap, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invokeAuthedEdgeFunction } from '@/lib/aiEdge';
import { toast } from 'sonner';
import type { DashTranslations } from '@/i18n/dashTranslations';
import { useProfile } from '@/hooks/useProfile';
import { exampleValue } from '@/lib/currency';
import { QuickAddPreview } from '@/components/dashboard/QuickAddPreview';
import { useQueryClient } from '@tanstack/react-query';
import { isTransfer } from '@/lib/transactionMath';

export interface QuickParsedTransaction {
  description: string;
  amount: number;
  type: 'expense' | 'income' | 'transfer';
  category_id?: string;
  account_id?: string;
  from_account_id?: string;
  to_account_id?: string;
  confidence?: number;
}

interface Props {
  userId: string | undefined;
  fmt: (n: number) => string;
  locale: 'fr' | 'en';
  t: DashTranslations;
  onAddNew: () => void;
  onTransfer: () => void;
  canTransfer: boolean;
  limitReached: boolean;
  transferDisabledReason?: string;
  thisMonthCount: number;
  monthlyLimit: number;
  isPremium: boolean;
  onQuickAdd?: (parsed: QuickParsedTransaction) => void;
  canUseAI?: boolean;
}

export const TransactionsHeroHeader = ({
  userId, fmt, locale, t, onAddNew, onTransfer, canTransfer,
  limitReached, transferDisabledReason, thisMonthCount, monthlyLimit, isPremium,
  onQuickAdd, canUseAI = true,
}: Props) => {
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickInput, setQuickInput] = useState('');
  const [quickLoading, setQuickLoading] = useState(false);
  const [preview, setPreview] = useState<QuickParsedTransaction | null>(null);
  const queryClient = useQueryClient();
  const isFr = locale === 'fr';
  const { currency } = useProfile();
  const quickPh = (() => {
    const c = exampleValue('coffee', currency);
    const t = exampleValue('taxi', currency);
    const s = exampleValue('salary', currency);
    return isFr
      ? `Ex: Café ${c}, Taxi ${t}, Salaire ${s}…`
      : `e.g. Coffee ${c}, Taxi ${t}, Salary ${s}…`;
  })();

  const handleQuickParse = async () => {
    const text = quickInput.trim();
    if (!text || quickLoading || !onQuickAdd) return;
    if (limitReached) {
      toast.error(transferDisabledReason || (isFr ? 'Limite mensuelle atteinte' : 'Monthly limit reached'));
      return;
    }
    setQuickLoading(true);
    try {
      const [{ data: cats }, { data: accs }] = await Promise.all([
        supabase.from('categories').select('id, name, type').is('deleted_at', null),
        supabase.from('payment_accounts').select('id, name').is('deleted_at', null).eq('status', 'active'),
      ]);
      const data = await invokeAuthedEdgeFunction<any>('ai-quick-parse', {
        locale,
        body: { input: text, categories: cats || [], accounts: accs || [], locale },
      });
      if (data?.error) throw new Error(data.error);
      if (!data?.description || typeof data.amount !== 'number') {
        throw new Error(
          isFr
            ? 'Je n\'ai pas compris. Reformule, par exemple : « Café 1500 » ou « Salaire 250000 ».'
            : 'I did not understand. Try e.g. "Coffee 1500" or "Salary 250000".'
        );
      }
      setPreview(data as QuickParsedTransaction);
    } catch (e: any) {
      toast.error(e?.message || (isFr ? 'Erreur IA' : 'AI error'));
    } finally {
      setQuickLoading(false);
    }
  };

  const closeQuick = () => {
    setPreview(null);
    setQuickInput('');
    setQuickOpen(false);
  };

  const monthStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  }, []);

  const { data: monthData } = useQuery({
    queryKey: ['tx-hero-month', userId, monthStart],
    queryFn: async () => {
      const { data } = await supabase
        .from('transactions')
        .select('amount, type, date, description, linked_transfer_id')
        .eq('user_id', userId!)
        .is('deleted_at', null)
        .gte('date', monthStart);
      const txs = data ?? [];
      let income = 0, expense = 0;
      const byDay = new Map<string, number>();
      for (const tx of txs) {
        if (isTransfer(tx as any)) continue; // Transfers never count as income/expense.
        const a = Number(tx.amount);
        if (tx.type === 'income') { income += a; byDay.set(tx.date, (byDay.get(tx.date) || 0) + a); }
        else if (tx.type === 'expense') { expense += a; byDay.set(tx.date, (byDay.get(tx.date) || 0) - a); }
      }
      // Build last-30-days sparkline (cumulative net)
      const today = new Date();
      const days: number[] = [];
      let cum = 0;
      for (let i = 29; i >= 0; i--) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        cum += (byDay.get(key) || 0);
        days.push(cum);
      }
      return { income, expense, net: income - expense, sparkline: days };
    },
    enabled: !!userId,
    staleTime: 30_000,
  });

  const income = monthData?.income ?? 0;
  const expense = monthData?.expense ?? 0;
  const net = monthData?.net ?? 0;
  const sparkline = monthData?.sparkline ?? [];

  // Build SVG sparkline path
  const sparkPath = useMemo(() => {
    if (!sparkline.length) return '';
    const min = Math.min(...sparkline, 0);
    const max = Math.max(...sparkline, 1);
    const range = max - min || 1;
    const w = 200, h = 40;
    return sparkline.map((v, i) => {
      const x = (i / (sparkline.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }, [sparkline]);

  const usagePct = !isPremium ? Math.min(100, (thisMonthCount / monthlyLimit) * 100) : 0;
  const periodLabel = locale === 'fr' ? 'Ce mois' : 'This month';

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-3xl border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass))] backdrop-blur-xl shadow-[var(--shadow-glass)]"
    >
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-secondary/12 blur-3xl" />

      <div className="relative px-5 sm:px-7 py-5 sm:py-6 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5 items-center">
        {/* Left: stats */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-primary/25 to-secondary/15 flex items-center justify-center border border-primary/20">
              <Wallet className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-display font-bold leading-tight">{t.allTransactions}</h2>
              <p className="text-[11px] text-muted-foreground/80 font-medium">
                {(() => {
                  const surplus = income - expense;
                  if (income === 0 && expense === 0) return isFr
                    ? `📝 Aucune opération · enregistrez votre première transaction`
                    : `📝 No operations yet · record your first transaction`;
                  if (surplus > 0) return isFr
                    ? `✅ Surplus de ${fmt(surplus)} ce mois · ${periodLabel}`
                    : `✅ Surplus of ${fmt(surplus)} this month · ${periodLabel}`;
                  if (surplus < 0) return isFr
                    ? `⚠️ Déficit de ${fmt(Math.abs(surplus))} · ${periodLabel}`
                    : `⚠️ Deficit of ${fmt(Math.abs(surplus))} · ${periodLabel}`;
                  return periodLabel;
                })()}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-secondary/20 bg-secondary/8 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-secondary uppercase tracking-wide">
                <TrendingUp className="w-3 h-3" />{t.income}
              </div>
              <div className="text-base sm:text-lg font-extrabold text-secondary tabular-nums mt-0.5">
                <AnimatedNumber value={income} format={fmt} duration={0.6} />
              </div>
            </div>
            <div className="rounded-2xl border border-destructive/20 bg-destructive/8 px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-destructive uppercase tracking-wide">
                <TrendingDown className="w-3 h-3" />{t.expenses}
              </div>
              <div className="text-base sm:text-lg font-extrabold text-destructive tabular-nums mt-0.5">
                <AnimatedNumber value={expense} format={fmt} duration={0.6} />
              </div>
            </div>
            <div className={`rounded-2xl border px-3 py-2.5 ${net >= 0 ? 'border-primary/20 bg-primary/8' : 'border-destructive/30 bg-destructive/10'}`}>
              <div className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide ${net >= 0 ? 'text-primary' : 'text-destructive'}`}>
                <Sparkles className="w-3 h-3" />{locale === 'fr' ? 'Solde' : 'Net'}
              </div>
              <div className={`text-base sm:text-lg font-extrabold tabular-nums mt-0.5 ${net >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {net >= 0 ? '+' : '−'}<AnimatedNumber value={Math.abs(net)} format={fmt} duration={0.6} />
              </div>
            </div>
          </div>

          {/* Sparkline */}
          {sparkPath && (
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide">
                {locale === 'fr' ? '30 derniers jours' : 'Last 30 days'}
              </span>
              <svg viewBox="0 0 200 40" className="flex-1 max-w-[260px] h-10">
                <defs>
                  <linearGradient id="txSparkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={`${sparkPath} L 200,40 L 0,40 Z`} fill="url(#txSparkGrad)" />
                <path d={sparkPath} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}

          {/* Usage bar (free plans) */}
          {!isPremium && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-semibold">
                <span className="text-muted-foreground/70 uppercase tracking-wide">
                  {locale === 'fr' ? 'Quota mensuel' : 'Monthly quota'}
                </span>
                <span className={`tabular-nums ${limitReached ? 'text-destructive' : 'text-foreground/70'}`}>
                  {thisMonthCount}/{monthlyLimit}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${usagePct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className={`h-full rounded-full ${limitReached ? 'bg-destructive' : usagePct > 80 ? 'bg-amber-500' : 'bg-primary'}`}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right: actions — 2 CTAs seulement. Le transfert est un onglet du formulaire. */}
        <div className="flex lg:flex-col gap-2 lg:items-stretch lg:min-w-[180px]">
          {(() => {
            const addTooltip = limitReached
              ? (isFr
                  ? `Limite du plan Gratuit atteinte : ${monthlyLimit} transactions/mois. Passez au plan Pro pour continuer.`
                  : `Free plan limit reached: ${monthlyLimit} transactions/month. Upgrade to Pro to continue.`)
              : (isFr
                  ? 'Dépense, revenu ou transfert — onglets dans le formulaire'
                  : 'Expense, income or transfer — tabs inside the form');
            return (
              <motion.div
                whileHover={limitReached ? undefined : { scale: 1.02 }}
                whileTap={limitReached ? undefined : { scale: 0.98 }}
                title={addTooltip}
                aria-label={addTooltip}
              >
                <Button
                  size="sm"
                  className="w-full text-primary-foreground rounded-xl shadow-md hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'var(--gradient-primary)' }}
                  onClick={onAddNew}
                  disabled={limitReached}
                  aria-disabled={limitReached}
                >
                  <Plus className="w-4 h-4 mr-1" />{t.addTransaction}
                </Button>
              </motion.div>
            );
          })()}
          {onQuickAdd && canUseAI && (
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                size="sm"
                variant="outline"
                className={`w-full rounded-xl border-primary/40 bg-primary/10 backdrop-blur-sm hover:bg-primary/15 text-primary ${quickOpen ? 'shadow-[0_0_0_2px_hsl(var(--primary)/0.25)]' : ''}`}
                onClick={() => setQuickOpen(v => !v)}
                disabled={limitReached}
                title={isFr ? 'Saisie rapide IA' : 'Quick AI entry'}
              >
                <Zap className="w-4 h-4 mr-1" />{isFr ? 'Saisie rapide' : 'Quick add'}
              </Button>
            </motion.div>
          )}
          {canTransfer && (
            <button
              type="button"
              onClick={onTransfer}
              className="w-full text-[11px] text-muted-foreground hover:text-primary transition-colors inline-flex items-center justify-center gap-1 py-1"
              title={isFr ? 'Ouvre le formulaire sur l\'onglet Transfert' : 'Open form on Transfer tab'}
            >
              <ArrowLeftRight className="w-3 h-3" />
              {isFr ? 'Ou faire un transfert' : 'Or make a transfer'}
            </button>
          )}
        </div>
      </div>

      {/* Quick-Add inline panel */}
      <AnimatePresence initial={false}>
        {quickOpen && onQuickAdd && (
          <motion.div
            key="quick-add-panel"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="relative border-t border-[hsl(var(--glass-border))] bg-gradient-to-r from-primary/8 via-transparent to-secondary/8 backdrop-blur-sm overflow-hidden"
          >
            <div className="px-5 sm:px-7 py-3 sm:py-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0 shadow-md">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <Input
                  autoFocus
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); handleQuickParse(); }
                    if (e.key === 'Escape') { closeQuick(); }
                  }}
                  placeholder={quickPh}
                  disabled={quickLoading || !!preview}
                  maxLength={500}
                  className="h-9 rounded-xl bg-background/70 border-primary/25 focus-visible:ring-primary/40 text-sm"
                />
                <p className="text-[10px] text-muted-foreground/70 mt-1 px-1">
                  {isFr ? '⌨️ Entrée pour parser · Échap pour fermer' : '⌨️ Enter to parse · Esc to close'}
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleQuickParse}
                disabled={!quickInput.trim() || quickLoading || !!preview}
                className="h-9 rounded-xl text-primary-foreground shrink-0"
                style={{ background: 'var(--gradient-primary)' }}
              >
                {quickLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span className="ml-1 hidden sm:inline">{isFr ? 'Pré-remplir' : 'Pre-fill'}</span>
              </Button>
              <Button aria-label="Fermer"
                size="icon"
                variant="ghost"
                onClick={closeQuick}
                className="h-9 w-9 rounded-xl shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            {preview && (
              <div className="px-5 sm:px-7 pb-4">
                <QuickAddPreview
                  initial={preview}
                  locale={locale}
                  onCancel={closeQuick}
                  onConfirmed={() => {
                    closeQuick();
                    // Refresh transaction lists, balances, budgets, etc.
                    queryClient.invalidateQueries();
                  }}
                  onEditAdvanced={(values) => {
                    onQuickAdd?.(values);
                    closeQuick();
                  }}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
