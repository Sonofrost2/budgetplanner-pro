import * as React from 'react';
import { Check, ChevronsUpDown, Link2, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';

export interface LinkPickerOption {
  id: string;
  name: string;
  icon?: string;
  amount?: number;
  amountSuffix?: string; // e.g. "/mois"
  day?: number | null;   // expected_day / contribution_day
  /** ID of an OTHER entity already linked to this option (to flag conflicts) */
  linkedToOtherId?: string | null;
  linkedToOtherName?: string | null;
}

interface LinkPickerProps {
  value: string; // selected id, '' = none
  onChange: (id: string) => void;
  options: LinkPickerOption[];
  fmt: (n: number) => string;
  locale: string;
  /** Current entity id being edited (so its own back-link is shown as "déjà lié à vous", not "indisponible") */
  selfId?: string | null;
  placeholder?: string;
  emptyHint?: string;
}

export function LinkPicker({
  value, onChange, options, fmt, locale, selfId,
  placeholder, emptyHint,
}: LinkPickerProps) {
  const [open, setOpen] = React.useState(false);
  const isFr = locale === 'fr';
  const selected = options.find(o => o.id === value);

  const dayLabel = (d?: number | null) => {
    if (!d) return null;
    return isFr ? `J-${d}` : `D-${d}`;
  };

  return (
    <div className="space-y-1.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between rounded-xl h-11 px-3 font-normal",
              "glass border-glass-border hover:bg-muted/30",
              !selected && "text-muted-foreground"
            )}
          >
            <span className="flex items-center gap-2 min-w-0 flex-1">
              {selected ? (
                <>
                  <span className="text-base shrink-0">{selected.icon || '🔗'}</span>
                  <span className="truncate font-medium text-foreground">{selected.name}</span>
                  {typeof selected.amount === 'number' && selected.amount > 0 && (
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 amount-display">
                      · {fmt(selected.amount)}{selected.amountSuffix || ''}
                    </span>
                  )}
                  {selected.day && (
                    <Badge variant="secondary" className="h-4 px-1.5 text-[9px] shrink-0">
                      {dayLabel(selected.day)}
                    </Badge>
                  )}
                </>
              ) : (
                <>
                  <Link2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{placeholder || (isFr ? 'Aucun élément lié' : 'No linked item')}</span>
                </>
              )}
            </span>
            <span className="flex items-center gap-1 shrink-0">
              {selected && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onChange(''); }}
                  className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
                  aria-label={isFr ? 'Retirer le lien' : 'Remove link'}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <ChevronsUpDown className="w-3.5 h-3.5 opacity-50" />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0 glass border-glass-border" align="start">
          <Command>
            <div className="flex items-center gap-2 px-3 border-b border-glass-border">
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <CommandInput
                placeholder={isFr ? 'Rechercher...' : 'Search...'}
                className="h-9 border-0 focus:ring-0"
              />
            </div>
            <CommandList className="max-h-64">
              <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
                {emptyHint || (isFr ? 'Aucun résultat' : 'No result')}
              </CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="__none__"
                  onSelect={() => { onChange(''); setOpen(false); }}
                  className="flex items-center gap-2 py-2"
                >
                  <div className="w-4 flex justify-center">
                    {!value && <Check className="w-3.5 h-3.5 text-primary" />}
                  </div>
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs italic text-muted-foreground">
                    {isFr ? 'Aucun lien' : 'No link'}
                  </span>
                </CommandItem>
                {options.map(opt => {
                  const isSelected = opt.id === value;
                  const conflict = opt.linkedToOtherId && opt.linkedToOtherId !== selfId;
                  return (
                    <CommandItem
                      key={opt.id}
                      value={`${opt.name} ${opt.icon || ''}`}
                      onSelect={() => { onChange(opt.id); setOpen(false); }}
                      className="flex items-center gap-2 py-2"
                    >
                      <div className="w-4 flex justify-center shrink-0">
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                      </div>
                      <span className="text-base shrink-0">{opt.icon || '🔗'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium truncate">{opt.name}</span>
                          {opt.day && (
                            <Badge variant="secondary" className="h-4 px-1.5 text-[9px] shrink-0">
                              {dayLabel(opt.day)}
                            </Badge>
                          )}
                          {conflict && (
                            <Badge variant="outline" className="h-4 px-1.5 text-[9px] border-amber-500/40 text-amber-500 shrink-0">
                              {isFr ? 'déjà lié' : 'already linked'}
                            </Badge>
                          )}
                        </div>
                        {typeof opt.amount === 'number' && opt.amount > 0 && (
                          <div className="text-[10px] text-muted-foreground tabular-nums amount-display">
                            {fmt(opt.amount)}{opt.amountSuffix || ''}
                            {conflict && opt.linkedToOtherName && (
                              <span className="ml-1 italic">
                                · {isFr ? 'à' : 'to'} {opt.linkedToOtherName}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}