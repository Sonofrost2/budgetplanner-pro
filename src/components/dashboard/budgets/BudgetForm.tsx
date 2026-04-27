import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResponsiveFormDialog } from '@/components/ui/responsive-form-dialog';
import { InputField } from '@/components/ui/input-field';
import { FormSection } from '@/components/ui/form-section';
import { CategoryCombobox } from '@/components/dashboard/CategoryCombobox';
import { TrendingUp, TrendingDown, Calendar, Tag, Settings2, BarChart3, CalendarClock } from 'lucide-react';
import { computeAnnualizedAmount } from '@/lib/budgetProjection';
import { currencySymbol, exampleAmount, amountLabel } from '@/lib/currency';
import type { DashTranslations } from '@/i18n/dashTranslations';

const VALID_PERIODS = ['daily', 'weekly', 'monthly', 'quarterly', 'semi_annual', 'yearly'] as const;

interface BudgetFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editId: string | null;
  form: {
    name: string; amount: string; category_id: string; period: string;
    alert_threshold: string; budget_type: string; control_type: string;
    expected_day: string; occurrence_frequency: string; reference_date: string; active_days: string;
  };
  setForm: React.Dispatch<React.SetStateAction<BudgetFormProps['form']>>;
  errors: Record<string, string>;
  saving: boolean;
  onSave: () => void;
  allCategories: any[];
  fmt: (n: number) => string;
  t: DashTranslations;
  locale: string;
  currency?: string;
}

export const BudgetForm = ({
  open, onOpenChange, editId, form, setForm, errors, saving, onSave,
  allCategories, fmt, t, locale, currency = 'EUR',
}: BudgetFormProps) => {
  const isFr = locale === 'fr';
  const filteredCategories = useMemo(() =>
    allCategories.filter(c => c.type === form.budget_type),
    [allCategories, form.budget_type]
  );

  const periodLabels: Record<string, string> = {
    daily: t.daily, weekly: t.weekly, monthly: t.monthly,
    quarterly: t.quarterly, semi_annual: t.semiAnnual, yearly: t.yearly,
  };

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={(o) => { onOpenChange(o); }}
      title={editId ? t.editBudget : t.addBudget}
      description={form.budget_type === 'income' ? t.createBudgetDescIncome : t.createBudgetDesc}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">{t.cancel}</Button>
          <Button className="text-primary-foreground rounded-xl min-w-[120px]" style={{ background: 'var(--gradient-primary)' }} onClick={onSave} disabled={saving}>{saving ? t.creating : t.save}</Button>
        </>
      }
    >
      <div className="space-y-4 py-2 form-animate">
        {/* Base Configuration */}
        <FormSection title={isFr ? 'Configuration de base' : 'Basic Setup'} icon={<Settings2 className="w-3.5 h-3.5" />}>
          <div className="space-y-1.5">
            <Label className="form-label">{t.budgetName}</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} maxLength={100} placeholder={t.budgetPlaceholder} className={`rounded-xl h-10 ${errors.name ? 'border-destructive' : ''}`} />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          {!editId && (
            <div className="space-y-1.5">
              <Label className="form-label">{t.budgetType}</Label>
              <div className="grid grid-cols-2 gap-2">
                {['expense', 'income'].map(bt => (
                  <button key={bt} type="button" onClick={() => {
                    const cats = allCategories.filter(c => c.type === bt);
                    setForm(f => ({ ...f, budget_type: bt, category_id: cats[0]?.id || '', control_type: bt === 'income' ? 'min' : 'max' }));
                  }}
                    className={`px-3 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all flex items-center gap-2 justify-center ${form.budget_type === bt ? 'border-primary bg-primary/10 text-primary shadow-sm' : 'border-border text-muted-foreground hover:bg-muted/50'}`}>
                    {bt === 'expense' ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                    {bt === 'expense' ? t.budgetTypeExpense : t.budgetTypeIncome}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground italic">
                💡 {isFr ? 'Dépense = surveiller un plafond. Revenu = suivre un objectif minimum.' : 'Expense = monitor a cap. Income = track a minimum target.'}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="form-label">{t.controlType}</Label>
            <div className="grid grid-cols-2 gap-2">
              {['max', 'min'].map(ct => (
                <button key={ct} type="button" onClick={() => setForm(f => ({ ...f, control_type: ct }))}
                  className={`px-3 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all text-center ${form.control_type === ct ? 'border-primary bg-primary/10 text-primary shadow-sm' : 'border-border text-muted-foreground hover:bg-muted/50'}`}>
                  {ct === 'max' ? t.controlTypeMax : t.controlTypeMin}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground italic">
              💡 {form.control_type === 'max'
                ? (isFr ? 'Plafond : alerte si vous dépassez le montant défini.' : 'Cap: alerts if you exceed the set amount.')
                : (isFr ? 'Objectif : alerte si vous n\'atteignez pas le montant défini.' : 'Target: alerts if you don\'t reach the set amount.')}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="form-label flex items-center gap-1.5"><Tag className="w-3 h-3" />{t.category}</Label>
            <CategoryCombobox
              categories={filteredCategories}
              value={form.category_id}
              onValueChange={v => setForm(f => ({ ...f, category_id: v }))}
              placeholder={t.selectCategory}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <InputField
              type="number" min="1" step="0.01"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: (e.target as HTMLInputElement).value }))}
              prefix={currencySymbol(currency)}
              label={amountLabel(form.control_type === 'min' ? t.target : t.budgetAmount, currency)}
              error={errors.amount}
              placeholder={exampleAmount(currency, locale)}
            />
            <div className="space-y-1.5">
              <Label className="form-label flex items-center gap-1.5"><Calendar className="w-3 h-3" />{t.period}</Label>
              <Select value={form.period} onValueChange={v => setForm(f => ({ ...f, period: v }))}>
                <SelectTrigger className={`rounded-xl h-11 ${errors.period ? 'border-destructive' : ''}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VALID_PERIODS.map(p => (
                    <SelectItem key={p} value={p}>{periodLabels[p] || p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.period && <p className="text-xs text-destructive">{errors.period}</p>}
            </div>
          </div>

          <InputField
            type="number" min="1" max="100"
            value={form.alert_threshold}
            onChange={e => setForm(f => ({ ...f, alert_threshold: (e.target as HTMLInputElement).value }))}
            suffix="%"
            label={t.alertThreshold}
            hint={isFr ? 'Seuil d\'alerte en pourcentage du budget' : 'Alert threshold as percentage of budget'}
          />
        </FormSection>

        {/* Impact Preview */}
        <div className="rounded-xl border border-primary/15 px-4 py-3 space-y-1" style={{ background: 'hsl(var(--primary) / 0.04)' }}>
          <p className="text-[11px] font-bold text-primary flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            {isFr ? 'Impact du paramétrage' : 'Configuration impact'}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {(() => {
              const amt = Number(form.amount) || 0;
              if (amt <= 0) return isFr ? 'Saisissez un montant pour voir l\'impact.' : 'Enter an amount to see the impact.';
              const annualized = computeAnnualizedAmount(amt, form.period, form.active_days);
              return `${fmt(amt)} → ${fmt(annualized)}/${isFr ? 'an' : 'yr'}`;
            })()}
          </p>
          {Number(form.amount) > 0 && (
            <p className="text-[11px] font-bold text-primary amount-display mt-1">
              → {isFr ? 'Coût annuel' : 'Annual cost'}: {fmt(computeAnnualizedAmount(Number(form.amount), form.period, form.active_days))}
            </p>
          )}
        </div>

        {/* Planning Section */}
        <FormSection title={isFr ? 'Planification' : 'Planning'} icon={<CalendarClock className="w-3.5 h-3.5" />} collapsible defaultOpen={!!editId}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="form-label flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />{t.expectedDay}
              </Label>
              <Input
                type="number" min="1" max={form.period === 'weekly' ? 7 : 31}
                value={form.expected_day}
                onChange={e => setForm(f => ({ ...f, expected_day: e.target.value }))}
                placeholder={form.period === 'weekly' ? '1-7' : '1-31'}
                className="rounded-xl h-10"
              />
              <p className="text-[10px] text-muted-foreground">
                {form.period === 'weekly' ? t.expectedDayWeekHint : t.expectedDayMonthHint}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="form-label">{t.occurrenceFrequency}</Label>
              <Select value={form.occurrence_frequency} onValueChange={v => setForm(f => ({ ...f, occurrence_frequency: v }))}>
                <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder={t.occurrenceAuto} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">{t.occurrenceOnce}</SelectItem>
                  <SelectItem value="daily">{t.daily}</SelectItem>
                  <SelectItem value="weekly">{t.weekly}</SelectItem>
                  <SelectItem value="biweekly">{t.occurrenceBiweekly}</SelectItem>
                  <SelectItem value="monthly">{t.monthly}</SelectItem>
                  <SelectItem value="quarterly">{t.quarterly}</SelectItem>
                  <SelectItem value="semi_annual">{t.semiAnnual}</SelectItem>
                  <SelectItem value="yearly">{t.yearly}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reference date */}
          {['quarterly', 'semi_annual', 'yearly', 'monthly'].includes(form.period) && (
            <div className="space-y-1.5">
              <Label className="form-label flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />{t.referenceDate}
              </Label>
              <Input type="date" value={form.reference_date} onChange={e => setForm(f => ({ ...f, reference_date: e.target.value }))} className="rounded-xl h-10" />
              {errors.reference_date && <p className="text-xs text-destructive">{errors.reference_date}</p>}
              <p className="text-[10px] text-muted-foreground italic">
                💡 {isFr ? 'Point d\'ancrage pour calculer les cycles budgétaires.' : 'Anchor point for budget cycles.'}
              </p>
              {form.reference_date && ['quarterly', 'semi_annual', 'yearly'].includes(form.period) && (
                <div className="bg-muted/50 rounded-lg px-3 py-2 text-[10px] space-y-0.5">
                  <p className="font-semibold text-muted-foreground">{t.nextOccurrence}:</p>
                  {(() => {
                    const refDate = new Date(form.reference_date);
                    const dates: string[] = [];
                    const increment = form.period === 'quarterly' ? 3 : form.period === 'semi_annual' ? 6 : 12;
                    const now = new Date();
                    let d = new Date(refDate);
                    while (d < now) { d.setMonth(d.getMonth() + increment); }
                    for (let i = 0; i < 4; i++) {
                      dates.push(d.toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }));
                      d = new Date(d); d.setMonth(d.getMonth() + increment);
                    }
                    return dates.map((dt, i) => <span key={i} className="inline-block mr-2 text-foreground font-medium">📅 {dt}</span>);
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Active days for daily budgets */}
          {form.period === 'daily' && (
            <div className="space-y-1.5">
              <Label className="form-label">{t.activeDays}</Label>
              <div className="flex gap-1.5">
                {[
                  { key: '1', label: t.activeDaysMon },
                  { key: '2', label: t.activeDaysTue },
                  { key: '3', label: t.activeDaysWed },
                  { key: '4', label: t.activeDaysThu },
                  { key: '5', label: t.activeDaysFri },
                  { key: '6', label: t.activeDaysSat },
                  { key: '7', label: t.activeDaysSun },
                ].map(day => {
                  const selected = form.active_days.split(',').filter(Boolean).includes(day.key);
                  return (
                    <button
                      key={day.key} type="button"
                      onClick={() => {
                        const current = form.active_days.split(',').filter(Boolean);
                        const next = selected ? current.filter(d => d !== day.key) : [...current, day.key].sort();
                        setForm(f => ({ ...f, active_days: next.join(',') }));
                      }}
                      className={`w-9 h-9 rounded-lg text-[10px] font-bold transition-all border ${selected ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/50'}`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 mt-1">
                <button type="button" className="text-[10px] text-primary underline" onClick={() => setForm(f => ({ ...f, active_days: '1,2,3,4,5,6,7' }))}>{t.allDays}</button>
                <button type="button" className="text-[10px] text-primary underline" onClick={() => setForm(f => ({ ...f, active_days: '1,2,3,4,5' }))}>{t.weekdays}</button>
              </div>
              {errors.active_days && <p className="text-xs text-destructive">{errors.active_days}</p>}
            </div>
          )}
        </FormSection>
      </div>
    </ResponsiveFormDialog>
  );
};
