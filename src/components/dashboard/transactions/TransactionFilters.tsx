import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import type { Category, Account } from '@/hooks/useDashboardData';
import type { DashTranslations } from '@/i18n/dashTranslations';

interface TransactionFiltersProps {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  filterType: string;
  onFilterTypeChange: (v: string) => void;
  filterCategory: string;
  onFilterCategoryChange: (v: string) => void;
  filterAccount: string;
  onFilterAccountChange: (v: string) => void;
  startDate: string;
  onStartDateChange: (v: string) => void;
  endDate: string;
  onEndDateChange: (v: string) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  categories: Category[];
  accounts: Account[];
  t: DashTranslations;
}

export const TransactionFilters = ({
  searchQuery, onSearchChange,
  filterType, onFilterTypeChange,
  filterCategory, onFilterCategoryChange,
  filterAccount, onFilterAccountChange,
  startDate, onStartDateChange,
  endDate, onEndDateChange,
  hasActiveFilters, onClearFilters,
  categories, accounts, t,
}: TransactionFiltersProps) => {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder={t.search + '...'} value={searchQuery} onChange={e => onSearchChange(e.target.value)} className="pl-10 rounded-xl" />
      </div>
      <Select value={filterType} onValueChange={onFilterTypeChange}>
        <SelectTrigger className="w-36 rounded-xl"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t.all}</SelectItem>
          <SelectItem value="income">{t.incomeType}</SelectItem>
          <SelectItem value="expense">{t.expenseType}</SelectItem>
        </SelectContent>
      </Select>
      <Select value={filterCategory} onValueChange={onFilterCategoryChange}>
        <SelectTrigger className="w-44 rounded-xl"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t.all} {t.category}</SelectItem>
          {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={filterAccount} onValueChange={onFilterAccountChange}>
        <SelectTrigger className="w-44 rounded-xl"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t.allAccounts}</SelectItem>
          {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Input type="date" value={startDate} onChange={e => onStartDateChange(e.target.value)} className="w-40 rounded-xl" />
      <Input type="date" value={endDate} onChange={e => onEndDateChange(e.target.value)} className="w-40 rounded-xl" />
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" className="rounded-xl text-muted-foreground" onClick={onClearFilters}>
          <X className="w-3.5 h-3.5 mr-1" />{t.clearFilters}
        </Button>
      )}
    </div>
  );
};
