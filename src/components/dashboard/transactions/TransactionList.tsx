import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Pencil, Trash2, Inbox, Plus, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
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
}

export const TransactionList = ({
  transactions, totalCount, page, totalPages,
  onPageChange, selectedIds, onToggleSelect, onToggleSelectAll, allPageSelected,
  sortField, sortOrder, onSort, onEdit, onDelete, onAddNew,
  isEmpty, fmt, t, locale,
}: TransactionListProps) => {
  return (
    <Card className="border border-border/50 shadow-[var(--shadow-card)] rounded-2xl overflow-hidden">
      <CardContent className="p-0">
        {transactions.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted mx-auto mb-4 flex items-center justify-center">
              <Inbox className="w-7 h-7 text-muted-foreground/40" />
            </div>
            {isEmpty ? (
              <>
                <p className="text-lg font-semibold text-muted-foreground mb-2">{t.noTransactions}</p>
                <p className="text-sm text-muted-foreground/70 mb-4">{t.addFirstTransaction}</p>
                <Button size="sm" className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={onAddNew}>
                  <Plus className="w-4 h-4 mr-1" />{t.addTransaction}
                </Button>
              </>
            ) : (
              <p className="text-lg font-semibold text-muted-foreground">{t.noResults}</p>
            )}
          </div>
        ) : (
          <>
            {/* Sort header */}
            <div className="flex items-center gap-4 px-5 py-2.5 bg-muted/30 border-b border-border/50 text-xs font-semibold text-muted-foreground">
              <div className="w-8 flex-shrink-0">
                <Checkbox checked={allPageSelected} onCheckedChange={onToggleSelectAll} />
              </div>
              <SortButton field="date" current={sortField} order={sortOrder} onSort={onSort} label={t.date} />
              <div className="flex-1" />
              <SortButton field="description" current={sortField} order={sortOrder} onSort={onSort} label={t.description} />
              <div className="flex-1" />
              <SortButton field="amount" current={sortField} order={sortOrder} onSort={onSort} label={t.amount} />
            </div>

            <div className="divide-y divide-border/50">
              {transactions.map(tx => (
                <div key={tx.id} className={`flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors ${selectedIds.has(tx.id) ? 'bg-primary/5' : ''}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 flex-shrink-0">
                      <Checkbox checked={selectedIds.has(tx.id)} onCheckedChange={() => onToggleSelect(tx.id)} />
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center text-lg flex-shrink-0">
                      {tx.categories?.icon || '📁'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{tx.description}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {tx.categories?.name || '-'} · {tx.payment_accounts?.icon} {tx.payment_accounts?.name || '-'} · {new Date(tx.date).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-sm font-bold tabular-nums amount-display ${tx.type === 'income' ? 'text-secondary amount-glow-green' : 'text-destructive amount-glow-red'}`}>
                      <span className="text-[0.85em] opacity-70 mr-0.5">{tx.type === 'income' ? '+' : '-'}</span>{fmt(Number(tx.amount))}
                    </span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => onEdit(tx)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive" onClick={() => onDelete(tx.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-border/50 bg-muted/20">
              <span className="text-xs text-muted-foreground">
                {totalCount} {t.results} — {t.page} {page + 1}/{totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-xl h-8" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />{t.previous}
                </Button>
                <Button variant="outline" size="sm" className="rounded-xl h-8" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>
                  {t.next}<ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>
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
  <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => onSort(field)}>
    {label} <ArrowUpDown className="w-3 h-3" />
    {current === field && <span className="text-primary">{order === 'asc' ? '↑' : '↓'}</span>}
  </button>
);
