import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ArrowUpDown, X } from 'lucide-react';

export interface SortOption {
  value: string;
  label: string;
}

export interface FilterChip {
  value: string;
  label: string;
  icon?: string;
  count?: number;
}

interface FilterToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  sortOptions?: SortOption[];
  sortValue?: string;
  onSortChange?: (value: string) => void;
  sortOrder?: 'asc' | 'desc';
  onSortOrderToggle?: () => void;
  filterChips?: FilterChip[];
  activeFilter?: string;
  onFilterChange?: (value: string) => void;
  allLabel?: string;
  totalCount?: number;
  debounceMs?: number;
}

export const FilterToolbar = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Rechercher...',
  sortOptions,
  sortValue,
  onSortChange,
  sortOrder = 'desc',
  onSortOrderToggle,
  filterChips,
  activeFilter = '',
  onFilterChange,
  allLabel = 'Tous',
  totalCount,
  debounceMs = 300,
}: FilterToolbarProps) => {
  const [localSearch, setLocalSearch] = useState(searchValue);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setLocalSearch(searchValue);
  }, [searchValue]);

  const handleSearchChange = (val: string) => {
    setLocalSearch(val);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearchChange(val), debounceMs);
  };

  const clearSearch = () => {
    setLocalSearch('');
    onSearchChange('');
  };

  return (
    <div className="space-y-3">
      {/* Search + Sort row */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={localSearch}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9 pr-8 rounded-xl h-10 bg-muted/30 border-border/50 focus:bg-background transition-colors"
          />
          {localSearch && (
            <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {sortOptions && sortOptions.length > 0 && onSortChange && (
          <div className="flex gap-1.5">
            <Select value={sortValue} onValueChange={onSortChange}>
              <SelectTrigger className="rounded-xl h-10 w-[160px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {onSortOrderToggle && (
              <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl shrink-0" onClick={onSortOrderToggle}>
                <ArrowUpDown className={`w-4 h-4 transition-transform ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Filter chips */}
      {filterChips && filterChips.length > 0 && onFilterChange && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => onFilterChange('')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${!activeFilter ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:bg-muted/50'}`}
          >
            {allLabel} {totalCount !== undefined ? `(${totalCount})` : ''}
          </button>
          {filterChips.map(chip => (
            <button
              key={chip.value}
              onClick={() => onFilterChange(activeFilter === chip.value ? '' : chip.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${activeFilter === chip.value ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:bg-muted/50'}`}
            >
              {chip.icon ? `${chip.icon} ` : ''}{chip.label}{chip.count !== undefined ? ` (${chip.count})` : ''}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
