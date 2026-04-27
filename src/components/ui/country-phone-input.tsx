import { useEffect, useMemo, useState } from 'react';
import { Phone, Search, Check, ChevronsUpDown, AlertCircle, ShieldAlert } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { COUNTRIES, DEFAULT_COUNTRY_CODE, findCountryByCode, getOrderedCountries, type Country } from '@/lib/countries';
import { formatAsYouType, validatePhone, getExampleNational } from '@/lib/phoneValidation';
import { cn } from '@/lib/utils';

interface Props {
  value: string;                    // E.164 (e.g. "+22507080910") or ""
  onChange: (e164: string, countryCode: string, isValid: boolean) => void;
  countryCode: string;              // ISO alpha-2
  onCountryChange: (code: string) => void;
  detectedCountry?: string | null;  // ISO alpha-2 from IP geo (for mismatch warning)
  locale: 'fr' | 'en';
  required?: boolean;
  className?: string;
  id?: string;
  showMismatchWarning?: boolean;
}

export const CountryPhoneInput = ({
  value,
  onChange,
  countryCode,
  onCountryChange,
  detectedCountry,
  locale,
  required,
  className,
  id,
  showMismatchWarning = true,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [national, setNational] = useState('');
  const [touched, setTouched] = useState(false);

  const ordered = useMemo(() => getOrderedCountries(locale), [locale]);
  const country = findCountryByCode(countryCode) || findCountryByCode(DEFAULT_COUNTRY_CODE)!;
  const placeholder = useMemo(() => getExampleNational(country.code) || '', [country.code]);

  // Sync national input when value changes externally
  useEffect(() => {
    if (!value) { setNational(''); return; }
    if (country && value.startsWith(country.dial)) {
      setNational(formatAsYouType(value.slice(country.dial.length), country.code));
    }
  }, [value, country]);

  const handleNationalChange = (raw: string) => {
    const formatted = formatAsYouType(raw, country.code);
    setNational(formatted);
    const e164 = validatePhone(raw, country.code);
    onChange(e164 || '', country.code, !!e164);
  };

  const handleCountryPick = (c: Country) => {
    onCountryChange(c.code);
    setOpen(false);
    // Re-validate the existing national number against the new country
    const e164 = validatePhone(national, c.code);
    onChange(e164 || '', c.code, !!e164);
  };

  const isInvalid = touched && national.trim().length > 0 && !validatePhone(national, country.code);
  const isValid = national.trim().length > 0 && !!validatePhone(national, country.code);
  const mismatch =
    showMismatchWarning &&
    detectedCountry &&
    detectedCountry.toUpperCase() !== country.code.toUpperCase();

  const detectedName = detectedCountry
    ? findCountryByCode(detectedCountry)
    : null;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="h-11 px-3 rounded-xl bg-background/60 backdrop-blur-sm border-border/60 hover:bg-background gap-1.5 shrink-0"
            >
              <span className="text-base leading-none">{country.flag}</span>
              <span className="text-sm font-medium tabular-nums">{country.dial}</span>
              <ChevronsUpDown className="w-3.5 h-3.5 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="start">
            <Command>
              <div className="flex items-center border-b px-3">
                <Search className="w-3.5 h-3.5 text-muted-foreground mr-2" />
                <CommandInput placeholder={locale === 'fr' ? 'Rechercher un pays…' : 'Search country…'} className="h-10 border-0" />
              </div>
              <CommandList className="max-h-72">
                <CommandEmpty>{locale === 'fr' ? 'Aucun résultat.' : 'No results.'}</CommandEmpty>
                <CommandGroup>
                  {ordered.map((c) => (
                    <CommandItem
                      key={c.code}
                      value={`${locale === 'fr' ? c.nameFr : c.nameEn} ${c.code} ${c.dial}`}
                      onSelect={() => handleCountryPick(c)}
                      className="gap-2"
                    >
                      <span className="text-base leading-none">{c.flag}</span>
                      <span className="flex-1 text-sm">{locale === 'fr' ? c.nameFr : c.nameEn}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{c.dial}</span>
                      {c.code === country.code && <Check className="w-3.5 h-3.5 text-primary" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <div className="relative flex-1">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            value={national}
            onChange={(e) => handleNationalChange(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={placeholder}
            required={required}
            className={cn(
              'pl-10 h-11 rounded-xl bg-background/60 backdrop-blur-sm border-border/60 focus-visible:border-primary/60',
              isInvalid && 'border-destructive/60 focus-visible:border-destructive',
              isValid && 'border-emerald-500/40',
            )}
          />
          {isValid && (
            <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
          )}
        </div>
      </div>

      {isInvalid && (
        <p className="flex items-center gap-1.5 text-[11px] text-destructive">
          <AlertCircle className="w-3 h-3" />
          {locale === 'fr'
            ? `Numéro invalide pour ${country.nameFr}. Vérifiez le format.`
            : `Invalid number for ${country.nameEn}. Please check the format.`}
        </p>
      )}

      {mismatch && detectedName && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <p className="text-[11px] leading-snug text-amber-800 dark:text-amber-200">
            {locale === 'fr'
              ? `Votre localisation suggère ${detectedName.flag} ${detectedName.nameFr}, mais vous avez choisi ${country.flag} ${country.nameFr}. Confirmez si vous voyagez ou utilisez un VPN.`
              : `Your location suggests ${detectedName.flag} ${detectedName.nameEn}, but you picked ${country.flag} ${country.nameEn}. Confirm if you are traveling or using a VPN.`}
          </p>
        </div>
      )}
    </div>
  );
};

export default CountryPhoneInput;