import { useState, useMemo } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n/LanguageContext';

interface Account {
  id: string;
  name: string;
  icon: string;
  type?: string;
}

interface AccountComboboxProps {
  accounts: Account[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  excludeId?: string;
  className?: string;
  error?: boolean;
  groupByType?: boolean;
}

const TYPE_LABELS: Record<'fr' | 'en', Record<string, string>> = {
  fr: {
    mobile_money: '📱 Mobile Money',
    bank: '🏦 Banque',
    cash: '💵 Espèces',
    card: '💳 Carte',
    savings: '🏦 Épargne',
  },
  en: {
    mobile_money: '📱 Mobile Money',
    bank: '🏦 Bank',
    cash: '💵 Cash',
    card: '💳 Card',
    savings: '🏦 Savings',
  },
};

export const AccountCombobox = ({
  accounts,
  value,
  onValueChange,
  placeholder,
  excludeId,
  className,
  error,
  groupByType = true,
}: AccountComboboxProps) => {
  const [open, setOpen] = useState(false);
  const { locale } = useLanguage();
  const fr = locale === 'fr';
  const labels = TYPE_LABELS[fr ? 'fr' : 'en'];
  const ph = placeholder ?? (fr ? 'Sélectionner un compte...' : 'Select an account...');

  const filteredAccounts = useMemo(
    () => (excludeId ? accounts.filter(a => a.id !== excludeId) : accounts),
    [accounts, excludeId]
  );

  const grouped = useMemo(() => {
    if (!groupByType) return { all: filteredAccounts };
    const groups: Record<string, Account[]> = {};
    filteredAccounts.forEach(a => {
      const type = a.type || 'other';
      if (!groups[type]) groups[type] = [];
      groups[type].push(a);
    });
    return groups;
  }, [filteredAccounts, groupByType]);

  const selected = accounts.find(a => a.id === value);

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
              <span className="truncate">{selected.name}</span>
            </span>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher un compte..." />
          <CommandList>
            <CommandEmpty>Aucun compte trouvé.</CommandEmpty>
            {Object.entries(grouped).map(([type, accs]) => (
              <CommandGroup key={type} heading={groupByType ? (TYPE_LABELS[type] || type) : undefined}>
                {accs.map(account => (
                  <CommandItem
                    key={account.id}
                    value={`${account.name} ${account.icon}`}
                    onSelect={() => {
                      onValueChange(account.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === account.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="mr-2">{account.icon}</span>
                    <span className="truncate">{account.name}</span>
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
