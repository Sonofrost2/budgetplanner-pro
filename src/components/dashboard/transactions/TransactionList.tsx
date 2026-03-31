import { useMemo, useRef, useCallback, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Pencil, Trash2, Inbox, Plus, ChevronLeft, ChevronRight, ArrowUpDown, MoreVertical, TrendingUp, TrendingDown, Clock, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.03 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 6, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.22, ease: 'easeOut' as const } },
};

/** Group transactions by date and compute daily sums */
const groupByDate = (transactions: Transaction[], locale: string) => {
  const groups: { date: string; label: string; txs: Transaction[]; income: number; expense: number }[] = [];
  let current: typeof groups[number] | null = null;

  for (const tx of transactions) {
    const d = tx.date;
    if (!current || current.date !== d) {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      let label: string;
      if (d === today) label = locale === 'fr' ? "Aujourd'hui" : 'Today';
      else if (d === yesterday) label = locale === 'fr' ? 'Hier' : 'Yesterday';
      else label = new Date(d + 'T12:00:00').toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      current = { date: d, label, txs: [], income: 0, expense: 0 };
      groups.push(current);
    }
    current.txs.push(tx);
    if (tx.type === 'income') current.income += Number(tx.amount);
    else current.expense += Number(tx.amount);
  }
  return groups;
};

/** KPI summary bar */
const KPIBar = ({ transactions, fmt, t }: { transactions: Transaction[]; fmt: (n: number) => string; t: DashTranslations }) => {
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
    <div className="flex items-center gap-4 px-5 py-3 bg-muted/20 border-b border-border/30">
      <div className="flex items-center gap-1.5">
        <TrendingUp className="w-3.5 h-3.5 text-secondary" />
        <span className="text-xs font-semibold text-secondary tabular-nums">+{fmt(totalIncome)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <TrendingDown className="w-3.5 h-3.5 text-destructive" />
        <span className="text-xs font-semibold text-destructive tabular-nums">-{fmt(totalExpense)}</span>
      </div>
      <div className="h-4 w-px bg-border/50" />
      <span className={`text-xs font-bold tabular-nums ${net >= 0 ? 'text-secondary' : 'text-destructive'}`}>
        {t.netBalance || (net >= 0 ? 'Net' : 'Net')}: {net >= 0 ? '+' : '-'}{fmt(Math.abs(net))}
      </span>
    </div>
  );
};

/** Pagination with page numbers */
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
    <div className="flex items-center justify-between px-5 py-3 border-t border-border/30 bg-muted/10">
      <span className="text-xs text-muted-foreground tabular-nums">
        {totalCount} {t.results} — {t.page} {page + 1}/{totalPages}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" disabled={page === 0} onClick={() => onPageChange(0)}>
          <ChevronsLeft className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`e${i}`} className="w-7 text-center text-xs text-muted-foreground">…</span>
          ) : (
            <Button
              key={p}
              variant={p === page ? 'default' : 'ghost'}
              size="icon"
              className={`h-7 w-7 rounded-lg text-xs font-medium ${p === page ? 'text-primary-foreground' : ''}`}
              onClick={() => onPageChange(p)}
            >
              {p + 1}
            </Button>
          )
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" disabled={page >= totalPages - 1} onClick={() => onPageChange(totalPages - 1)}>
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
      {/* Action buttons revealed on swipe */}
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

export const TransactionList = ({
  transactions, totalCount, page, totalPages,
  onPageChange, selectedIds, onToggleSelect, onToggleSelectAll, allPageSelected,
  sortField, sortOrder, onSort, onEdit, onDelete, onAddNew,
  isEmpty, fmt, t, locale, isFetching,
}: TransactionListProps) => {
  const groups = useMemo(() => groupByDate(transactions, locale), [transactions, locale]);
  const isMobile = useIsMobile();

  return (
    <Card className={`border border-border/40 rounded-2xl overflow-hidden shadow-[var(--shadow-card)] transition-all duration-300 ${isFetching ? 'opacity-60' : ''}`}>
      <CardContent className="p-0">
        {transactions.length === 0 ? (
          <motion.div className="py-20 text-center" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
            <motion.div
              className="w-16 h-16 rounded-2xl bg-muted/50 mx-auto mb-4 flex items-center justify-center"
              animate={{ rotate: [0, -5, 5, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
            >
              <Inbox className="w-7 h-7 text-muted-foreground/40" />
            </motion.div>
            {isEmpty ? (
              <>
                <p className="text-lg font-semibold text-muted-foreground mb-2">{t.noTransactions}</p>
                <p className="text-sm text-muted-foreground/70 mb-5">{t.addFirstTransaction}</p>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button size="sm" className="text-primary-foreground rounded-xl shadow-md" style={{ background: 'var(--gradient-primary)' }} onClick={onAddNew}>
                    <Plus className="w-4 h-4 mr-1" />{t.addTransaction}
                  </Button>
                </motion.div>
              </>
            ) : (
              <p className="text-lg font-semibold text-muted-foreground">{t.noResults}</p>
            )}
          </motion.div>
        ) : (
          <>
            {/* KPI Summary */}
            <KPIBar transactions={transactions} fmt={fmt} t={t} />

            {/* Sort header */}
            <div className="flex items-center gap-4 px-5 py-2.5 bg-muted/20 border-b border-border/30 text-xs font-semibold text-muted-foreground">
              <div className="w-8 flex-shrink-0"><Checkbox checked={allPageSelected} onCheckedChange={onToggleSelectAll} /></div>
              <SortButton field="date" current={sortField} order={sortOrder} onSort={onSort} label={t.date} />
              <div className="flex-1" />
              <SortButton field="description" current={sortField} order={sortOrder} onSort={onSort} label={t.description} />
              <div className="flex-1" />
              <SortButton field="amount" current={sortField} order={sortOrder} onSort={onSort} label={t.amount} />
            </div>

            {/* Grouped transaction rows */}
            <div>
              {groups.map(group => (
                <div key={group.date}>
                  {/* Date separator with daily sum */}
                  <div className="sticky top-0 z-10 flex items-center gap-3 px-5 py-2 bg-muted/50 backdrop-blur-sm border-b border-border/30">
                    <div className="h-px flex-1 bg-border/40" />
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                      {group.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60">({group.txs.length})</span>
                    <div className="flex items-center gap-2 text-[10px] tabular-nums">
                      {group.income > 0 && <span className="text-secondary font-semibold">+{fmt(group.income)}</span>}
                      {group.expense > 0 && <span className="text-destructive font-semibold">-{fmt(group.expense)}</span>}
                    </div>
                    <div className="h-px flex-1 bg-border/40" />
                  </div>

                  <motion.div
                    className="divide-y divide-border/30"
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                  >
                    {group.txs.map((tx, index) => {
                      const rowContent = (
                        <motion.div
                          key={tx.id}
                          variants={itemVariants}
                          layout
                          className={`group flex items-center justify-between px-5 py-3 transition-all duration-200 cursor-default active:scale-[0.995] ${
                            selectedIds.has(tx.id)
                              ? 'bg-primary/5 border-l-2 border-l-primary'
                              : 'hover:bg-muted/20 border-l-2 border-l-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-8 flex-shrink-0">
                              <Checkbox checked={selectedIds.has(tx.id)} onCheckedChange={() => onToggleSelect(tx.id)} />
                            </div>

                            <motion.div
                              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 relative"
                              style={{
                                background: tx.categories?.color ? `${tx.categories.color}15` : 'hsl(var(--muted) / 0.5)',
                              }}
                              whileHover={{ scale: 1.1, rotate: 5 }}
                              transition={{ type: 'spring', stiffness: 400 }}
                            >
                              {tx.categories?.icon || '📁'}
                              <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${tx.type === 'income' ? 'bg-secondary' : 'bg-destructive'}`} />
                            </motion.div>

                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate leading-tight">{tx.description}</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {tx.categories?.name || '-'} · {tx.payment_accounts?.icon} {tx.payment_accounts?.name || '-'}
                              </p>
                              <p className="text-[10px] text-muted-foreground/50 flex items-center gap-1 mt-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                {locale === 'fr' ? 'Saisi le' : 'Created'} {new Date(tx.created_at).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                            <motion.span
                              className={`text-sm font-bold tabular-nums amount-display px-2 py-1 rounded-lg ${
                                tx.type === 'income'
                                  ? 'text-secondary bg-secondary/8 amount-glow-green'
                                  : 'text-destructive bg-destructive/8 amount-glow-red'
                              }`}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: index * 0.02 + 0.1 }}
                            >
                              <span className="text-[0.85em] opacity-70 mr-0.5">{tx.type === 'income' ? '+' : '-'}</span>{fmt(Number(tx.amount))}
                            </motion.span>

                            {/* Desktop: hover actions */}
                            {!isMobile && (
                              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted/60" onClick={() => onEdit(tx)}>
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10" onClick={() => onDelete(tx.id)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            )}

                            {/* Mobile: context menu */}
                            {isMobile && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl">
                                  <DropdownMenuItem onClick={() => onEdit(tx)} className="gap-2">
                                    <Pencil className="w-3.5 h-3.5" /> {t.edit}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => onDelete(tx.id)} className="gap-2 text-destructive focus:text-destructive">
                                    <Trash2 className="w-3.5 h-3.5" /> {t.delete}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </motion.div>
                      );

                      if (isMobile) {
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
    className={`flex items-center gap-1 transition-colors duration-200 ${current === field ? 'text-primary font-bold' : 'hover:text-foreground'}`}
    onClick={() => onSort(field)}
  >
    {label}
    <ArrowUpDown className={`w-3 h-3 transition-transform duration-200 ${current === field ? 'text-primary' : ''}`} />
    {current === field && (
      <motion.span
        key={order}
        initial={{ opacity: 0, y: order === 'asc' ? 4 : -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-primary text-xs"
      >
        {order === 'asc' ? '↑' : '↓'}
      </motion.span>
    )}
  </button>
);
