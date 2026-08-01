import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { CategoryCombobox } from '@/components/dashboard/CategoryCombobox';
import { AccountCombobox } from '@/components/dashboard/AccountCombobox';
import { TagsInput } from '@/components/dashboard/transactions/TagsInput';
import { Button as UIButton } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import type { Category, Account } from '@/hooks/useDashboardData';
import type { DashTranslations } from '@/i18n/dashTranslations';

export interface BulkModifyForm {
  category_id: string;
  account_id: string;
  tags: string[];
  tagsMode: 'add' | 'replace';
}

interface BulkModifyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  accounts: Account[];
  form: BulkModifyForm;
  setForm: (fn: (f: BulkModifyForm) => BulkModifyForm) => void;
  onApply: () => void;
  selectedCount: number;
  t: DashTranslations;
  locale: string;
}

export const BulkModifyDialog = ({
  open, onOpenChange, categories, accounts, form, setForm, onApply, selectedCount, t, locale,
}: BulkModifyDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="text-xl font-bold">{t.bulkModify}</DialogTitle>
        <DialogDescription>{t.selectedCount(selectedCount)}</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label className="form-label">{t.bulkModifyCategory}</Label>
          <CategoryCombobox
            categories={categories}
            value={form.category_id}
            onValueChange={v => setForm(f => ({ ...f, category_id: v }))}
            placeholder={t.selectCategory}
            groupByType
          />
        </div>
        <div className="space-y-2">
          <Label className="form-label">{t.bulkModifyAccount}</Label>
          <AccountCombobox
            accounts={accounts}
            value={form.account_id}
            onValueChange={v => setForm(f => ({ ...f, account_id: v }))}
            placeholder={locale === 'fr' ? 'Rechercher...' : 'Search...'}
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label className="form-label">{locale === 'fr' ? 'Tags (association)' : 'Tags (link)'}</Label>
            <div className="flex items-center gap-1">
              {(['add', 'replace'] as const).map(mode => (
                <UIButton
                  key={mode}
                  type="button"
                  size="sm"
                  variant={form.tagsMode === mode ? 'default' : 'outline'}
                  className="h-7 rounded-lg text-[11px] px-2"
                  onClick={() => setForm(f => ({ ...f, tagsMode: mode }))}
                >
                  {mode === 'add'
                    ? (locale === 'fr' ? 'Ajouter' : 'Add')
                    : (locale === 'fr' ? 'Remplacer' : 'Replace')}
                </UIButton>
              ))}
            </div>
          </div>
          <TagsInput
            value={form.tags}
            onChange={tags => setForm(f => ({ ...f, tags }))}
            locale={locale}
          />
        </div>
      </div>
      <DialogFooter className="gap-2 sm:gap-0">
        <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">{t.cancel}</Button>
        <Button className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }} onClick={onApply}>{t.applyChanges}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

interface BudgetOverspendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetName: string;
  onConfirm: () => void;
  t: DashTranslations;
  locale: string;
}

export const BudgetOverspendDialog = ({
  open, onOpenChange, budgetName, onConfirm, t, locale,
}: BudgetOverspendDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          {locale === 'fr' ? 'Budget dépassé' : 'Budget exceeded'}
        </AlertDialogTitle>
        <AlertDialogDescription>
          {locale === 'fr'
            ? `Le budget "${budgetName}" est déjà consommé à 100%. Souhaitez-vous quand même imputer cette dépense ? Cela créera un dépassement volontaire.`
            : `The budget "${budgetName}" is already 100% consumed. Do you still want to record this expense? This will create a voluntary overspend.`}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel className="rounded-xl">{t.cancel}</AlertDialogCancel>
        <AlertDialogAction className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onConfirm}>
          {locale === 'fr' ? 'Confirmer le dépassement' : 'Confirm overspend'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
