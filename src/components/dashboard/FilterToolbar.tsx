import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ArrowUpDown, X, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  searchPlaceholder = 'Rechercher... (ex: terme1 ; terme2)',
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
  const [focused, setFocused] = useState(false);
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
        <div className={`relative flex-1 group transition-all duration-300 ${focused ? 'scale-[1.01]' : ''}`}>
          <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200 ${focused ? 'text-primary' : 'text-muted-foreground'}`} />
          <Input
            value={localSearch}
            onChange={e => handleSearchChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={searchPlaceholder}
            className={`pl-10 pr-9 rounded-xl h-11 bg-background/60 border-border/40 transition-all duration-300 
              focus:bg-background focus:border-primary/40 focus:shadow-[0_0_0_3px_hsl(var(--primary)/0.08)]
              hover:border-border/60 hover:bg-background/80`}
          />
          <AnimatePresence>
            {localSearch && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={clearSearch}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-full hover:bg-muted/50"
              >
                <X className="w-3.5 h-3.5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        {sortOptions && sortOptions.length > 0 && onSortChange && (
          <div className="flex gap-1.5">
            <Select value={sortValue} onValueChange={onSortChange}>
              <SelectTrigger className="rounded-xl h-11 w-[160px] text-xs border-border/40 bg-background/60 hover:bg-background/80 transition-colors">
                <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {onSortOrderToggle && (
              <Button
                variant="outline"
                size="icon"
                className={`h-11 w-11 rounded-xl shrink-0 border-border/40 bg-background/60 hover:bg-background/80 transition-all duration-200 ${sortOrder === 'asc' ? 'text-primary' : ''}`}
                onClick={onSortOrderToggle}
              >
                <ArrowUpDown className={`w-4 h-4 transition-transform duration-300 ${sortOrder === 'asc' ? 'rotate-180' : ''}`} />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Filter chips */}
      {filterChips && filterChips.length > 0 && onFilterChange && (
        <div className="flex flex-wrap gap-1.5">
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => onFilterChange('')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 border
              ${!activeFilter
                ? 'bg-primary text-primary-foreground border-primary shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.4)]'
                : 'bg-background/60 text-muted-foreground border-border/40 hover:bg-background/80 hover:border-border/60 hover:text-foreground'
              }`}
          >
            {allLabel} {totalCount !== undefined ? <span className="ml-1 opacity-70">{totalCount}</span> : ''}
          </motion.button>
          {filterChips.map((chip, i) => (
            <motion.button
              key={chip.value}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onFilterChange(activeFilter === chip.value ? '' : chip.value)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 border
                ${activeFilter === chip.value
                  ? 'bg-primary text-primary-foreground border-primary shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.4)]'
                  : 'bg-background/60 text-muted-foreground border-border/40 hover:bg-background/80 hover:border-border/60 hover:text-foreground'
                }`}
            >
              {chip.icon ? <span className="mr-1">{chip.icon}</span> : null}
              {chip.label}
              {chip.count !== undefined ? <span className="ml-1 opacity-70">{chip.count}</span> : ''}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
};
