import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { InputField } from '@/components/ui/input-field';
import { ResponsiveFormDialog } from '@/components/ui/responsive-form-dialog';
import { CategoryCombobox } from '@/components/dashboard/CategoryCombobox';
import { AccountCombobox } from '@/components/dashboard/AccountCombobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useFamilyCategories } from '@/hooks/useFamilyCategories';
import { TrendingUp, TrendingDown, Calendar, FileText, CreditCard, Tag, Sparkles, Loader2, StickyNote, Users, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { DashTranslations } from '@/i18n/dashTranslations';

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: any | null;
  form: {
    description: string; amount: string; type: string;
    category_id: string; account_id: string; date: string; notes: string;
    family_category_id?: string;
  };
  setForm: React.Dispatch<React.SetStateAction<{
    description: string; amount: string; type: string;
    category_id: string; account_id: string; date: string; notes: string;
    family_category_id?: string;
  }>>;
  errors: Record<string, string>;
  saving: boolean;
  onSave: () => void;
  categories: any[];
  accounts: any[];
  recentDescriptions: any[];
  canUseAISuggestions: boolean;
  t: DashTranslations;
  locale: string;
  currency?: string;
}

export const TransactionForm = ({
  open, onOpenChange, editing, form, setForm, errors, saving, onSave,
  categories, accounts, recentDescriptions, canUseAISuggestions, t, locale, currency = 'FCFA',
}: TransactionFormProps) => {
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredCategories = categories.filter(c => c.type === form.type);

  const descriptionSuggestions = useMemo(() => {
    if (!form.description || form.description.length < 2) return [];
    const q = form.description.toLowerCase();
    return recentDescriptions
      .filter(tx => tx.description.toLowerCase().includes(q))
      .slice(0, 5);
  }, [form.description, recentDescriptions]);

  const handleAISuggest = async () => {
    if (!canUseAISuggestions) return;
    setAiSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-suggest', {
        body: {
          description: form.description, type: form.type,
          categories: categories.filter(c => c.type === form.type).map(c => ({ id: c.id, name: c.name })),
          accounts: accounts.map(a => ({ id: a.id, name: a.name })), locale,
        },
      });
      if (error) throw error;
      if (data?.description) setForm(f => ({ ...f, description: data.description }));
      if (data?.category_id) setForm(f => ({ ...f, category_id: data.category_id }));
      if (data?.amount) setForm(f => ({ ...f, amount: String(data.amount) }));
      if (data?.account_id) setForm(f => ({ ...f, account_id: data.account_id }));
      toast.success(t.aiSuggest);
    } catch (e: any) {
      toast.error(e.message || 'AI error');
    } finally {
      setAiSuggesting(false);
    }
  };

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? t.edit : t.addTransaction}
      description={t.fillTransactionDetails}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">{t.cancel}</Button>
          <Button className="text-primary-foreground rounded-xl min-w-[120px] shadow-md" style={{ background: 'var(--gradient-primary)' }} onClick={onSave} disabled={saving}>
            {saving ? (locale === 'fr' ? 'Enregistrement...' : 'Saving...') : t.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4 py-2 form-animate">
        {/* Type selector */}
        <div className="space-y-2">
          <Label className="form-label">{t.type}</Label>
          <div className="grid grid-cols-2 gap-2">
            <motion.button type="button" onClick={() => setForm(f => ({ ...f, type: 'expense', category_id: '' }))}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${form.type === 'expense' ? 'border-destructive bg-destructive/10 text-destructive shadow-sm' : 'border-border bg-card text-muted-foreground hover:bg-muted/50'}`}>
              <TrendingDown className="w-4 h-4" />{t.expenseType}
            </motion.button>
            <motion.button type="button" onClick={() => setForm(f => ({ ...f, type: 'income', category_id: '' }))}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${form.type === 'income' ? 'border-secondary bg-secondary/10 text-secondary shadow-sm' : 'border-border bg-card text-muted-foreground hover:bg-muted/50'}`}>
              <TrendingUp className="w-4 h-4" />{t.incomeType}
            </motion.button>
          </div>
        </div>

        {/* Amount & Date */}
        <div className="grid grid-cols-2 gap-4">
          <InputField
            type="number" min="0.01" step="0.01"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: (e.target as HTMLInputElement).value }))}
            prefix={currency}
            label={t.amount}
            error={errors.amount}
            placeholder="0"
            className={errors.amount ? 'border-destructive' : ''}
          />
          <InputField
            type="date"
            value={form.date}
            onChange={e => setForm(f => ({ ...f, date: (e.target as HTMLInputElement).value }))}
            icon={<Calendar className="w-3 h-3" />}
            label={t.date}
            error={errors.date}
          />
        </div>

        {/* Description with AI */}
        <div className="space-y-2 relative z-30">
          <div className="flex items-center justify-between">
            <Label className="form-label flex items-center gap-1.5"><FileText className="w-3 h-3" />{t.description}</Label>
            {canUseAISuggestions && (
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs rounded-lg text-primary" onClick={handleAISuggest} disabled={aiSuggesting}>
                <Sparkles className="w-3 h-3 mr-1" />{aiSuggesting ? t.aiSuggesting : t.aiSuggest}
              </Button>
            )}
          </div>
          <Input value={form.description} maxLength={200}
            onChange={e => { setForm(f => ({ ...f, description: e.target.value })); setShowSuggestions(true); }}
            onBlur={() => {
              setTimeout(() => setShowSuggestions(false), 200);
              if (canUseAISuggestions && form.description.trim().length >= 3 && !form.category_id && !aiSuggesting) {
                (async () => {
                  try {
                    const { data } = await supabase.functions.invoke('ai-categorize', {
                      body: {
                        description: form.description.trim(),
                        type: form.type,
                        categories: categories.filter(c => c.type === form.type).map(c => ({ id: c.id, name: c.name })),
                        recentTransactions: recentDescriptions.slice(0, 30).map(tx => ({
                          description: tx.description,
                          category_name: categories.find(c => c.id === tx.category_id)?.name || null,
                        })),
                        locale,
                      },
                    });
                    if (data?.category_id && data.confidence >= 0.5) {
                      setForm(f => ({ ...f, category_id: data.category_id }));
                      toast.success(locale === 'fr' ? '🏷️ Catégorie détectée automatiquement' : '🏷️ Category auto-detected', { duration: 2000 });
                    }
                  } catch { /* silent */ }
                })();
              }
              if (canUseAISuggestions && form.description.trim().length >= 3 && !form.amount && !aiSuggesting) {
                handleAISuggest();
              }
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder={locale === 'fr' ? 'Ex: Courses supermarché' : 'E.g: Grocery shopping'}
            className={`rounded-xl h-11 ${errors.description ? 'border-destructive' : ''}`} />
          {aiSuggesting && (
            <div className="absolute right-3 top-[calc(100%-2rem)] flex items-center gap-1 text-xs text-primary">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{locale === 'fr' ? 'IA...' : 'AI...'}</span>
            </div>
          )}
          {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
          <AnimatePresence>
            {showSuggestions && descriptionSuggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                className="relative z-10 mt-1 bg-popover border border-border rounded-xl shadow-xl max-h-48 overflow-y-auto"
              >
                {descriptionSuggestions.map((s, i) => {
                  const cat = categories.find(c => c.id === s.category_id);
                  const acc = accounts.find(a => a.id === s.account_id);
                  return (
                    <button key={i} type="button" className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors flex items-center gap-2"
                      onMouseDown={(e) => { e.preventDefault(); setForm(f => ({ ...f, description: s.description, category_id: s.category_id || f.category_id, account_id: s.account_id || f.account_id })); setShowSuggestions(false); }}>
                      <span className="truncate flex-1">{s.description}</span>
                      <span className="flex items-center gap-1.5 shrink-0 text-xs text-muted-foreground">
                        {cat && <span className="flex items-center gap-0.5" title={cat.name}><span>{cat.icon}</span><span className="hidden sm:inline max-w-[80px] truncate">{cat.name}</span></span>}
                        {acc && <span className="flex items-center gap-0.5 border-l border-border pl-1.5" title={acc.name}><span>{acc.icon}</span><span className="hidden sm:inline max-w-[80px] truncate">{acc.name}</span></span>}
                      </span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label className="form-label flex items-center gap-1.5"><Tag className="w-3 h-3" />{t.category}</Label>
          <CategoryCombobox
            categories={filteredCategories}
            value={form.category_id}
            onValueChange={v => setForm(f => ({ ...f, category_id: v }))}
            placeholder={locale === 'fr' ? 'Rechercher une catégorie...' : 'Search category...'}
          />
        </div>

        {/* Account */}
        <div className="space-y-2">
          <Label className="form-label flex items-center gap-1.5"><CreditCard className="w-3 h-3" />{t.account}</Label>
          <AccountCombobox
            accounts={accounts}
            value={form.account_id}
            onValueChange={v => setForm(f => ({ ...f, account_id: v }))}
            placeholder={locale === 'fr' ? 'Rechercher un compte...' : 'Search account...'}
          />
        </div>

        {/* Notes with char counter */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="form-label flex items-center gap-1.5">
              <StickyNote className="w-3 h-3" />
              {t.notes} <span className="text-muted-foreground/50 font-normal normal-case">({locale === 'fr' ? 'optionnel' : 'optional'})</span>
            </Label>
            {form.notes && (
              <span className={`text-[10px] tabular-nums ${form.notes.length > 450 ? 'text-destructive' : 'text-muted-foreground/50'}`}>
                {form.notes.length}/500
              </span>
            )}
          </div>
          <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} maxLength={500} rows={2}
            className={`rounded-xl resize-none ${errors.notes ? 'border-destructive' : ''}`} placeholder={locale === 'fr' ? 'Ajoutez une note...' : 'Add a note...'} />
          {errors.notes && <p className="text-xs text-destructive">{errors.notes}</p>}
        </div>
      </div>
    </ResponsiveFormDialog>
  );
};
