import { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Pencil, Trash2, Inbox, Plus, ChevronLeft, ChevronRight, ArrowUpDown, MoreVertical, TrendingUp, TrendingDown, Clock, ChevronsLeft, ChevronsRight, Calendar, LayoutList, LayoutGrid, ArrowLeftRight, Lock } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Transaction } from '@/hooks/useDashboardData';
import type { DashTranslations } from '@/i18n/dashTranslations';

type SortField = 'date' | 'amount' | 'description';
type SortOrder = 'asc' | 'desc';

interface TransactionListProps {
  transactions: Transaction[];
  totalCount: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  allPageSelected: boolean;
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  onAddNew: () => void;
  isEmpty: boolean;
  fmt: (n: number) => string;
  t: DashTranslations;
  locale: string;
  isFetching?: boolean;
  onFilterCategory?: (categoryId: string) => void;
  onFilterAccount?: (accountId: string) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
};

/** Group transactions by date, sort within group by created_at desc, compute daily sums */
const groupByDate = (transactions: Transaction[], locale: string) => {
  const groups: { date: string; label: string; weekday: string; txs: Transaction[]; income: number; expense: number }[] = [];
  let current: typeof groups[number] | null = null;

  // Sort within same date by created_at descending
  const sorted = [...transactions].sort((a, b) => {
    if (a.date !== b.date) return 0; // keep server order across dates
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  for (const tx of sorted) {
    const d = tx.date;
    if (!current || current.date !== d) {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const dateObj = new Date(d + 'T12:00:00');
      const loc = locale === 'fr' ? 'fr-FR' : 'en-US';
      let label: string;
      let weekday: string;
      if (d === today) {
        label = locale === 'fr' ? "Aujourd'hui" : 'Today';
        weekday = dateObj.toLocaleDateString(loc, { weekday: 'long' });
      } else if (d === yesterday) {
        label = locale === 'fr' ? 'Hier' : 'Yesterday';
        weekday = dateObj.toLocaleDateString(loc, { weekday: 'long' });
      } else {
        label = dateObj.toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' });
        weekday = dateObj.toLocaleDateString(loc, { weekday: 'long' });
      }
      current = { date: d, label, weekday, txs: [], income: 0, expense: 0 };
      groups.push(current);
    }
    current.txs.push(tx);
    if (tx.type === 'income') current.income += Number(tx.amount);
    else current.expense += Number(tx.amount);
  }
  return groups;
};

/** Animated counter */
const AnimatedAmount = ({ value, prefix, fmt, className }: { value: number; prefix: string; fmt: (n: number) => string; className: string }) => {
  const motionVal = useMotionValue(0);
  const [display, setDisplay] = useState(fmt(0));

  useEffect(() => {
    const controls = animate(motionVal, value, {
      duration: 0.6,
      ease: [0.25, 0.46, 0.45, 0.94],
      onUpdate: (v) => setDisplay(fmt(Math.abs(v))),
    });
    return controls.stop;
  }, [value, fmt]);

  return (
    <span className={className}>
      <span className="text-[0.85em] opacity-70 mr-0.5">{prefix}</span>{display}
    </span>
  );
};

/** KPI summary bar — glassmorphism */
const KPIBar = ({ transactions, fmt, locale }: { transactions: Transaction[]; fmt: (n: number) => string; locale: string }) => {
  const { totalIncome, totalExpense } = useMemo(() => {
    let inc = 0, exp = 0;
    for (const tx of transactions) {
      if (tx.type === 'income') inc += Number(tx.amount);
      else exp += Number(tx.amount);
    }
    return { totalIncome: inc, totalExpense: exp };
  }, [transactions]);

  const net = totalIncome - totalExpense;

  return (
    <div className="flex items-center gap-3 sm:gap-5 px-5 py-3.5 bg-[hsl(var(--glass))] backdrop-blur-xl border-b border-[hsl(var(--glass-border))]">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary/10 border border-secondary/20">
        <TrendingUp className="w-3.5 h-3.5 text-secondary" />
        <AnimatedAmount value={totalIncome} prefix="+" fmt={fmt} className="text-xs font-bold text-secondary tabular-nums" />
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-destructive/10 border border-destructive/20">
        <TrendingDown className="w-3.5 h-3.5 text-destructive" />
        <AnimatedAmount value={totalExpense} prefix="-" fmt={fmt} className="text-xs font-bold text-destructive tabular-nums" />
      </div>
      <div className="h-5 w-px bg-border/40 hidden sm:block" />
      <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border ${net >= 0 ? 'bg-secondary/5 border-secondary/15' : 'bg-destructive/5 border-destructive/15'}`}>
        <span className={`text-xs font-extrabold tabular-nums ${net >= 0 ? 'text-secondary' : 'text-destructive'}`}>
          {locale === 'fr' ? 'Solde' : 'Net'}: {net >= 0 ? '+' : '-'}{fmt(Math.abs(net))}
        </span>
      </div>
    </div>
  );
};

/** Pagination with page numbers — glassmorphism */
const PaginationBar = ({ page, totalPages, totalCount, onPageChange, t }: {
  page: number; totalPages: number; totalCount: number;
  onPageChange: (p: number) => void; t: DashTranslations;
}) => {
  const pages = useMemo(() => {
    const result: (number | 'ellipsis')[] = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 0; i < totalPages; i++) result.push(i);
    } else {
      result.push(0);
      let start = Math.max(1, page - 1);
      let end = Math.min(totalPages - 2, page + 1);
      if (page <= 2) { start = 1; end = 3; }
      if (page >= totalPages - 3) { start = totalPages - 4; end = totalPages - 2; }
      if (start > 1) result.push('ellipsis');
      for (let i = start; i <= end; i++) result.push(i);
      if (end < totalPages - 2) result.push('ellipsis');
      result.push(totalPages - 1);
    }
    return result;
  }, [page, totalPages]);

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-[hsl(var(--glass-border))] bg-[hsl(var(--glass))] backdrop-blur-sm">
      <span className="text-[11px] text-muted-foreground tabular-nums font-medium">
        {totalCount} {t.results} — {t.page} {page + 1}/{totalPages}
      </span>
      <div className="flex items-center gap-0.5">
        <Button aria-label="Action" variant="ghost" size="icon" className="h-7 w-7 rounded-lg" disabled={page === 0} onClick={() => onPageChange(0)}>
          <ChevronsLeft className="w-3.5 h-3.5" />
        </Button>
        <Button aria-label="Précédent" variant="ghost" size="icon" className="h-7 w-7 rounded-lg" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`e${i}`} className="w-7 text-center text-xs text-muted-foreground">…</span>
          ) : (
            <Button aria-label="Action"
              key={p}
              variant={p === page ? 'default' : 'ghost'}
              size="icon"
              className={`h-7 w-7 rounded-lg text-xs font-semibold transition-all ${p === page ? 'text-primary-foreground shadow-md' : 'hover:bg-muted/40'}`}
              onClick={() => onPageChange(p)}
            >
              {p + 1}
            </Button>
          )
        )}
        <Button aria-label="Suivant" variant="ghost" size="icon" className="h-7 w-7 rounded-lg" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
        <Button aria-label="Action" variant="ghost" size="icon" className="h-7 w-7 rounded-lg" disabled={page >= totalPages - 1} onClick={() => onPageChange(totalPages - 1)}>
          <ChevronsRight className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};

/** Swipeable row for mobile */
const SwipeableRow = ({ children, onEdit, onDelete }: { children: React.ReactNode; onEdit: () => void; onDelete: () => void }) => {
  const startX = useRef(0);
  const [offset, setOffset] = useState(0);
  const [swiped, setSwiped] = useState(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setSwiped(false);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const diff = startX.current - e.touches[0].clientX;
    if (diff > 10) setOffset(Math.min(diff, 140));
    else setOffset(0);
  }, []);

  const onTouchEnd = useCallback(() => {
    if (offset > 70) setSwiped(true);
    else { setSwiped(false); setOffset(0); }
  }, [offset]);

  return (
    <div className="relative overflow-hidden">
      <div className="absolute right-0 top-0 bottom-0 flex items-stretch">
        <button
          onClick={() => { onEdit(); setOffset(0); setSwiped(false); }}
          className="w-[70px] flex items-center justify-center bg-primary text-primary-foreground"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => { onDelete(); setOffset(0); setSwiped(false); }}
          className="w-[70px] flex items-center justify-center bg-destructive text-destructive-foreground"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div
        className="relative bg-card transition-transform duration-200 ease-out"
        style={{ transform: `translateX(-${swiped ? 140 : offset}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={() => { if (swiped) { setSwiped(false); setOffset(0); } }}
      >
        {children}
      </div>
    </div>
  );
};

/** Gradient for category icon based on color */
const getCategoryGradient = (color?: string, type?: string) => {
  if (color) {
    return `linear-gradient(135deg, ${color}30, ${color}15)`;
  }
  if (type === 'income') return 'linear-gradient(135deg, hsl(var(--secondary) / 0.2), hsl(var(--secondary) / 0.08))';
  return 'linear-gradient(135deg, hsl(var(--muted) / 0.6), hsl(var(--muted) / 0.3))';
};

/** Explicit transfer badge — small, glassy, accessible */
const TransferBadge = ({ locale, compact = false }: { locale: string; compact?: boolean }) => (
  <span
    className={`inline-flex items-center gap-0.5 rounded-md font-bold uppercase tracking-wide bg-primary/10 text-primary border border-primary/20 ${
      compact ? 'px-1 py-0 text-[8px] leading-tight' : 'px-1.5 py-0.5 text-[9px]'
    }`}
    title={locale === 'fr' ? 'Transfert entre comptes' : 'Transfer between accounts'}
  >
    <ArrowLeftRight className={compact ? 'w-2 h-2' : 'w-2.5 h-2.5'} />
    {locale === 'fr' ? 'Transfert' : 'Transfer'}
  </span>
);

/** Privacy indicator — shared (family) vs private (lock). Tiny, accessible, glassy. */
const PrivacyIndicator = ({ shared, locale, compact = false }: { shared: boolean; locale: string; compact?: boolean }) => {
  const size = compact ? 'w-2.5 h-2.5' : 'w-3 h-3';
  const wrap = compact ? 'w-4 h-4' : 'w-5 h-5';
  if (shared) {
    return (
      <span
        className={`inline-flex items-center justify-center ${wrap} rounded-md bg-primary/12 text-primary border border-primary/20 flex-shrink-0`}
        title={locale === 'fr' ? 'Visible par votre famille' : 'Visible to your family'}
        aria-label={locale === 'fr' ? 'Partagée avec la famille' : 'Shared with family'}
      >
        <span className={compact ? 'text-[9px]' : 'text-[11px]'} aria-hidden>👨‍👩‍👧</span>
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center justify-center ${wrap} rounded-md bg-muted/40 text-muted-foreground/60 border border-border/30 flex-shrink-0`}
      title={locale === 'fr' ? 'Transaction privée — visible uniquement par vous' : 'Private transaction — visible only to you'}
      aria-label={locale === 'fr' ? 'Privée' : 'Private'}
    >
      <Lock className={size} />
    </span>
  );
};

export const TransactionList = ({
  transactions, totalCount, page, totalPages,
  onPageChange, selectedIds, onToggleSelect, onToggleSelectAll, allPageSelected,
  sortField, sortOrder, onSort, onEdit, onDelete, onAddNew,
  isEmpty, fmt, t, locale, isFetching,
}: TransactionListProps) => {
  const groups = useMemo(() => groupByDate(transactions, locale), [transactions, locale]);
  const isMobile = useIsMobile();
  const [condensed, setCondensed] = useState(false);

  return (
    <Card className={`border border-[hsl(var(--glass-border))] rounded-2xl overflow-hidden shadow-[var(--shadow-glass)] backdrop-blur-sm bg-[hsl(var(--glass))] transition-all duration-300 ${isFetching ? 'opacity-50' : ''}`}>
      <CardContent className="p-0">
        {transactions.length === 0 ? (
          <motion.div className="relative py-16 text-center overflow-hidden" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
            <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-primary/8 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 right-1/4 w-56 h-56 rounded-full bg-secondary/8 blur-3xl" />
            <motion.div
              className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/15 via-primary/5 to-secondary/15 mx-auto mb-5 flex items-center justify-center border border-primary/20 shadow-lg"
              animate={{ rotate: [0, -3, 3, 0], scale: [1, 1.03, 1] }}
              transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
            >
              <Inbox className="w-10 h-10 text-primary/50" />
            </motion.div>
            {isEmpty ? (
              <>
                <p className="relative text-xl font-bold font-display mb-2">
                  {locale === 'fr' ? '🧭 Premier pas vers la clarté' : '🧭 First step toward clarity'}
                </p>
                <p className="relative text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                  {locale === 'fr'
                    ? 'Saisissez une dépense ou un revenu — votre Coach commencera à analyser vos flux dès la première entrée.'
                    : 'Add an expense or income — your Coach will start analyzing your flows from the very first entry.'}
                </p>
                <motion.div className="relative inline-block" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button size="default" className="text-primary-foreground rounded-xl shadow-lg shadow-primary/25" style={{ background: 'var(--gradient-primary)' }} onClick={onAddNew}>
                    <Plus className="w-4 h-4 mr-1.5" />{t.addTransaction}
                  </Button>
                </motion.div>
              </>
            ) : (
              <p className="relative text-lg font-bold text-foreground/60">{t.noResults}</p>
            )}
          </motion.div>
        ) : (
          <>
            {/* KPI Summary */}
            <KPIBar transactions={transactions} fmt={fmt} locale={locale} />

            {/* Sort header — glass */}
            <div className="flex items-center gap-4 px-5 py-2.5 bg-muted/15 backdrop-blur-sm border-b border-border/20 text-xs font-semibold text-muted-foreground">
              <div className="w-8 flex-shrink-0"><Checkbox checked={allPageSelected} onCheckedChange={onToggleSelectAll} /></div>
              <SortButton field="date" current={sortField} order={sortOrder} onSort={onSort} label={t.date} />
              <div className="flex-1" />
              <SortButton field="description" current={sortField} order={sortOrder} onSort={onSort} label={t.description} />
              <div className="flex-1" />
              <SortButton field="amount" current={sortField} order={sortOrder} onSort={onSort} label={t.amount} />
              <div className="ml-auto pl-2">
                <Button aria-label="Action"
                  variant="ghost"
                  size="icon"
                  className={`h-7 w-7 rounded-lg transition-colors ${condensed ? 'bg-primary/10 text-primary' : 'hover:bg-muted/40'}`}
                  onClick={() => setCondensed(c => !c)}
                  title={condensed ? (locale === 'fr' ? 'Vue détaillée' : 'Detailed view') : (locale === 'fr' ? 'Vue condensée' : 'Condensed view')}
                >
                  {condensed ? <LayoutGrid className="w-3.5 h-3.5" /> : <LayoutList className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>

            {/* Grouped transaction rows */}
            <div>
              {groups.map((group, groupIndex) => (
                <div key={group.date}>
                  {/* Date separator — compact or detailed */}
                  {condensed ? (
                    <div className="sticky top-0 z-10 px-5 py-1.5 bg-muted/30 backdrop-blur-sm border-b border-border/15 flex items-center gap-2">
                      <span className="text-[10px] font-bold text-foreground/70 capitalize">{group.label}</span>
                      <span className="text-[9px] text-muted-foreground/40 capitalize">{group.weekday}</span>
                      <span className="text-[9px] text-muted-foreground/40 bg-muted/40 px-1.5 py-0.5 rounded-full font-semibold">{group.txs.length}</span>
                      <div className="flex-1" />
                      {group.income > 0 && <span className="text-[9px] font-bold text-secondary tabular-nums">+{fmt(group.income)}</span>}
                      {group.expense > 0 && <span className="text-[9px] font-bold text-destructive tabular-nums">-{fmt(group.expense)}</span>}
                    </div>
                  ) : (
                    <div className="relative sticky top-0 z-10 px-5 py-2.5 bg-gradient-to-r from-primary/[0.04] via-muted/40 to-secondary/[0.04] backdrop-blur-xl border-b border-border/20">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/15 flex flex-col items-center justify-center">
                          <Calendar className="w-3 h-3 text-primary/70 mb-0.5" />
                          <span className="text-[9px] font-extrabold text-primary/80 leading-none">
                            {new Date(group.date + 'T12:00:00').getDate()}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-foreground/80 capitalize">{group.label}</span>
                            <span className="text-[9px] font-medium text-muted-foreground/50 capitalize">{group.weekday}</span>
                            <span className="text-[9px] text-muted-foreground/40 bg-muted/40 px-1.5 py-0.5 rounded-full font-semibold">{group.txs.length}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {group.income > 0 && <span className="text-[10px] font-bold text-secondary tabular-nums">+{fmt(group.income)}</span>}
                            {group.expense > 0 && <span className="text-[10px] font-bold text-destructive tabular-nums">-{fmt(group.expense)}</span>}
                            {group.income > 0 && group.expense > 0 && (
                              <>
                                <span className="text-muted-foreground/30">·</span>
                                <span className={`text-[10px] font-bold tabular-nums ${group.income - group.expense >= 0 ? 'text-secondary/70' : 'text-destructive/70'}`}>
                                  = {group.income - group.expense >= 0 ? '+' : '-'}{fmt(Math.abs(group.income - group.expense))}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      {groupIndex < groups.length - 1 && (
                        <div className="absolute left-[39px] top-full w-px h-full bg-gradient-to-b from-primary/15 to-transparent pointer-events-none" />
                      )}
                    </div>
                  )}

                  <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                  >
                    {group.txs.map((tx, index) => {
                      const rowContent = condensed ? (
                        /* ── Condensed row ── */
                        <motion.div
                          key={tx.id}
                          variants={itemVariants}
                          layout
                          className={`group relative flex items-center gap-2 px-4 py-2.5 transition-all duration-200 cursor-default border-b border-border/8 last:border-b-0 ${
                            selectedIds.has(tx.id)
                              ? 'bg-primary/[0.06] border-l-2 border-l-primary'
                              : 'hover:bg-[hsl(var(--glass-hover))] border-l-2 border-l-transparent'
                          }`}
                          whileTap={{ scale: 0.998 }}
                        >
                          <Checkbox className="h-3.5 w-3.5" checked={selectedIds.has(tx.id)} onCheckedChange={() => onToggleSelect(tx.id)} />
                          <PrivacyIndicator shared={!!tx.family_category_id} locale={locale} compact />
                          <span className="text-sm flex-shrink-0">{tx.categories?.icon || '📁'}</span>
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${tx.type === 'income' ? 'bg-secondary' : 'bg-destructive'}`} />
                          <span className="text-xs font-semibold truncate flex-1 text-foreground/85 flex items-center gap-1.5 min-w-0">
                            <span className="truncate">{tx.description}</span>
                            {tx.linked_transfer_id && <TransferBadge locale={locale} compact />}
                          </span>
                          <span className="text-[10px] text-muted-foreground/50 flex-shrink-0 tabular-nums hidden sm:inline">
                            {tx.categories?.name || '-'}
                          </span>
                          <span className="text-[10px] text-muted-foreground/40 flex-shrink-0 tabular-nums hidden md:inline">
                            {tx.payment_accounts?.icon} {tx.payment_accounts?.name || '-'}
                          </span>
                          <span className={`text-xs font-bold tabular-nums flex-shrink-0 ${tx.type === 'income' ? 'text-secondary' : 'text-destructive'}`}>
                            {tx.type === 'income' ? '+' : '-'}{fmt(Number(tx.amount))}
                          </span>
                          {/* Desktop: hover actions */}
                          {!isMobile && (
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <Button aria-label="Modifier" variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-primary/10 hover:text-primary" onClick={() => onEdit(tx)}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button aria-label="Supprimer" variant="ghost" size="icon" className="h-6 w-6 rounded-md text-destructive hover:bg-destructive/10" onClick={() => onDelete(tx.id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                          {isMobile && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button aria-label="Plus d’options" variant="ghost" size="icon" className="h-6 w-6 rounded-md"><MoreVertical className="w-3 h-3" /></Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="rounded-xl backdrop-blur-xl bg-[hsl(var(--popover))] border border-[hsl(var(--glass-border))]">
                                <DropdownMenuItem onClick={() => onEdit(tx)} className="gap-2 rounded-lg"><Pencil className="w-3.5 h-3.5" /> {t.edit}</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDelete(tx.id)} className="gap-2 text-destructive focus:text-destructive rounded-lg"><Trash2 className="w-3.5 h-3.5" /> {t.delete}</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </motion.div>
                      ) : (
                        /* ── Detailed row ── */
                        <motion.div
                          key={tx.id}
                          variants={itemVariants}
                          layout
                          className={`group relative flex items-center justify-between px-5 py-4 sm:py-5 transition-all duration-300 cursor-default border-b border-border/10 last:border-b-0 ${
                            selectedIds.has(tx.id)
                              ? 'bg-primary/[0.06] border-l-[3px] border-l-primary'
                              : 'hover:bg-[hsl(var(--glass-hover))] border-l-[3px] border-l-transparent'
                          }`}
                          whileTap={{ scale: 0.998 }}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-8 flex-shrink-0">
                              <Checkbox checked={selectedIds.has(tx.id)} onCheckedChange={() => onToggleSelect(tx.id)} />
                            </div>
                            <motion.div
                              className="w-11 h-11 rounded-2xl flex items-center justify-center text-lg flex-shrink-0 relative border border-white/10 shadow-sm"
                              style={{ background: getCategoryGradient(tx.categories?.color, tx.type) }}
                              whileHover={{ scale: 1.1, rotate: 5 }}
                              transition={{ type: 'spring', stiffness: 400 }}
                            >
                              {tx.categories?.icon || '📁'}
                              <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background shadow-sm ${
                                tx.type === 'income' ? 'bg-secondary shadow-secondary/30' : 'bg-destructive shadow-destructive/30'
                              }`} />
                            </motion.div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold truncate leading-tight text-foreground/90 flex items-center gap-1.5">
                                <PrivacyIndicator shared={!!tx.family_category_id} locale={locale} />
                                <span className="truncate">{tx.description}</span>
                                {tx.linked_transfer_id && <TransferBadge locale={locale} />}
                              </p>
                              <p className="text-[11px] text-muted-foreground/70 mt-0.5 flex items-center gap-1">
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-muted/30 text-[10px] font-medium">{tx.categories?.name || '-'}</span>
                                <span className="text-muted-foreground/30">·</span>
                                {tx.payment_accounts?.icon} {tx.payment_accounts?.name || '-'}
                              </p>
                              <p className="text-[10px] text-muted-foreground/40 flex items-center gap-1 mt-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                {new Date(tx.created_at).toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                <span className="text-muted-foreground/20 mx-0.5">·</span>
                                {new Date(tx.created_at).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                            <motion.div
                              className={`relative px-3 py-1.5 rounded-xl text-sm font-extrabold tabular-nums ${tx.type === 'income' ? 'text-secondary' : 'text-destructive'}`}
                              style={{
                                background: tx.type === 'income'
                                  ? 'linear-gradient(135deg, hsl(var(--secondary) / 0.12), hsl(var(--secondary) / 0.04))'
                                  : 'linear-gradient(135deg, hsl(var(--destructive) / 0.12), hsl(var(--destructive) / 0.04))',
                                boxShadow: tx.type === 'income'
                                  ? '0 2px 12px -2px hsl(var(--secondary) / 0.15)'
                                  : '0 2px 12px -2px hsl(var(--destructive) / 0.15)',
                              }}
                              initial={{ opacity: 0, scale: 0.85 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: index * 0.03 + 0.1, type: 'spring', stiffness: 300 }}
                            >
                              <span className="text-[0.82em] opacity-60 mr-0.5">{tx.type === 'income' ? '+' : '-'}</span>
                              {fmt(Number(tx.amount))}
                            </motion.div>
                            {!isMobile && (
                              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                                <Button aria-label="Modifier" variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => onEdit(tx)}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button aria-label="Supprimer" variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-destructive hover:bg-destructive/10 transition-colors" onClick={() => onDelete(tx.id)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            )}
                            {isMobile && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button aria-label="Plus d’options" variant="ghost" size="icon" className="h-8 w-8 rounded-xl"><MoreVertical className="w-4 h-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl backdrop-blur-xl bg-[hsl(var(--popover))] border border-[hsl(var(--glass-border))]">
                                  <DropdownMenuItem onClick={() => onEdit(tx)} className="gap-2 rounded-lg"><Pencil className="w-3.5 h-3.5" /> {t.edit}</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => onDelete(tx.id)} className="gap-2 text-destructive focus:text-destructive rounded-lg"><Trash2 className="w-3.5 h-3.5" /> {t.delete}</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </motion.div>
                      );

                      if (isMobile && !condensed) {
                        return (
                          <SwipeableRow key={tx.id} onEdit={() => onEdit(tx)} onDelete={() => onDelete(tx.id)}>
                            {rowContent}
                          </SwipeableRow>
                        );
                      }
                      return rowContent;
                    })}
                  </motion.div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <PaginationBar page={page} totalPages={totalPages} totalCount={totalCount} onPageChange={onPageChange} t={t} />
          </>
        )}
      </CardContent>
    </Card>
  );
};

const SortButton = ({ field, current, order, onSort, label }: {
  field: SortField; current: SortField; order: SortOrder;
  onSort: (f: SortField) => void; label: string;
}) => (
  <button
    className={`flex items-center gap-1 transition-all duration-200 rounded-lg px-1.5 py-0.5 ${current === field ? 'text-primary font-bold bg-primary/5' : 'hover:text-foreground hover:bg-muted/30'}`}
    onClick={() => onSort(field)}
  >
    {label}
    <ArrowUpDown className={`w-3 h-3 transition-transform duration-200 ${current === field ? 'text-primary' : ''}`} />
    {current === field && (
      <motion.span
        key={order}
        initial={{ opacity: 0, y: order === 'asc' ? 4 : -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-primary text-xs font-bold"
      >
        {order === 'asc' ? '↑' : '↓'}
      </motion.span>
    )}
  </button>
);
