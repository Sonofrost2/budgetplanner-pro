import { useState, useMemo } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n/LanguageContext';

interface Category {
  id: string;
  name: string;
  icon: string;
  type?: string;
  color?: string;
  parent_category_id?: string | null;
}

interface CategoryComboboxProps {
  categories: Category[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  error?: boolean;
  groupByType?: boolean;
}

const TYPE_LABELS: Record<'fr' | 'en', Record<string, string>> = {
  fr: { expense: '📉 Dépenses', income: '📈 Revenus' },
  en: { expense: '📉 Expenses', income: '📈 Income' },
};

export const CategoryCombobox = ({
  categories,
  value,
  onValueChange,
  placeholder,
  className,
  error,
  groupByType = false,
}: CategoryComboboxProps) => {
  const [open, setOpen] = useState(false);
  const { locale } = useLanguage();
  const fr = locale === 'fr';
  const labels = TYPE_LABELS[fr ? 'fr' : 'en'];
  const ph = placeholder ?? (fr ? 'Sélectionner une catégorie...' : 'Select a category...');

  // Build parent → children map for hierarchical display
  const byId = useMemo(() => {
    const m = new Map<string, Category>();
    categories.forEach(c => m.set(c.id, c));
    return m;
  }, [categories]);

  // Order: each root followed by its children (indented). Orphans (parent not visible) treated as roots.
  const orderCats = (list: Category[]): Array<{ cat: Category; depth: number }> => {
    const childrenOf = new Map<string | null, Category[]>();
    list.forEach(c => {
      const pid = c.parent_category_id && byId.has(c.parent_category_id) ? c.parent_category_id : null;
      const arr = childrenOf.get(pid) ?? [];
      arr.push(c);
      childrenOf.set(pid, arr);
    });
    for (const arr of childrenOf.values()) arr.sort((a, b) => a.name.localeCompare(b.name));
    const out: Array<{ cat: Category; depth: number }> = [];
    const walk = (parent: string | null, depth: number) => {
      const kids = childrenOf.get(parent) ?? [];
      for (const k of kids) {
        out.push({ cat: k, depth });
        walk(k.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  };

  const grouped = useMemo(() => {
    if (!groupByType) return { all: orderCats(categories) };
    const groups: Record<string, Category[]> = {};
    categories.forEach(c => {
      const type = c.type || 'other';
      if (!groups[type]) groups[type] = [];
      groups[type].push(c);
    });
    const out: Record<string, Array<{ cat: Category; depth: number }>> = {};
    for (const [type, cats] of Object.entries(groups)) out[type] = orderCats(cats);
    return out;
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, groupByType, byId]);

  const selected = categories.find(c => c.id === value);
  const selectedParent = selected?.parent_category_id ? byId.get(selected.parent_category_id) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between rounded-xl h-11 font-normal',
            error && 'border-destructive',
            !value && 'text-muted-foreground',
            className
          )}
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              <span>{selected.icon}</span>
              <span className="truncate">
                {selectedParent && (
                  <span className="text-muted-foreground">{selectedParent.name} › </span>
                )}
                {selected.name}
              </span>
            </span>
          ) : (
            ph
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={fr ? 'Rechercher une catégorie...' : 'Search category...'} />
          <CommandList>
            <CommandEmpty>{fr ? 'Aucune catégorie trouvée.' : 'No category found.'}</CommandEmpty>
            {Object.entries(grouped).map(([type, cats]) => (
              <CommandGroup key={type} heading={groupByType ? (labels[type] || type) : undefined}>
                {cats.map(({ cat, depth }) => (
                  <CommandItem
                    key={cat.id}
                    value={`${cat.name} ${cat.icon}`}
                    onSelect={() => {
                      onValueChange(cat.id);
                      setOpen(false);
                    }}
                    style={{ paddingLeft: `${0.5 + depth * 1}rem` }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === cat.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {depth > 0 && (
                      <span className="mr-1 text-muted-foreground/60 text-xs">└</span>
                    )}
                    <span className="mr-2">{cat.icon}</span>
                    <span className={cn('truncate', depth === 0 && 'font-medium')}>{cat.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
