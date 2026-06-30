import { useState, useMemo, useEffect, useRef } from 'react';
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
import { TrendingUp, TrendingDown, Calendar, FileText, CreditCard, Tag, Sparkles, Loader2, StickyNote, Users, Lock, ArrowLeftRight, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { currencySymbol, exampleAmount, amountLabel } from '@/lib/currency';
import { invokeAuthedEdgeFunction } from '@/lib/aiEdge';
import { toast } from 'sonner';
import type { DashTranslations } from '@/i18n/dashTranslations';
import { useSpeechRecognition, isSpeechRecognitionSupported } from '@/hooks/useSpeechRecognition';
import { VoiceMicButton } from './VoiceMicButton';

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: any | null;
  form: {
    description: string; amount: string; type: string;
    category_id: string; account_id: string; date: string; notes: string;
    family_category_id?: string;
    from_account_id?: string; to_account_id?: string;
  };
  setForm: React.Dispatch<React.SetStateAction<{
    description: string; amount: string; type: string;
    category_id: string; account_id: string; date: string; notes: string;
    family_category_id?: string;
    from_account_id?: string; to_account_id?: string;
  }>>;
  errors: Record<string, string>;
  saving: boolean;
  onSave: () => void;
  /** Called when user switches to transfer tab and submits — runs perform_transfer RPC. */
  onTransfer?: () => Promise<void> | void;
  /** Hide the transfer tab (e.g., when editing an existing transaction). */
  allowTransfer?: boolean;
  /** When set, transfer tab is shown but disabled with this tooltip reason. */
  transferDisabledReason?: string;
  categories: any[];
  accounts: any[];
  recentDescriptions: any[];
  savingsGoals?: any[];
  budgets?: any[];
  canUseAISuggestions: boolean;
  t: DashTranslations;
  locale: string;
  currency?: string;
}

export const TransactionForm = ({
  open, onOpenChange, editing, form, setForm, errors, saving, onSave,
  onTransfer, allowTransfer = true, transferDisabledReason,
  categories, accounts, recentDescriptions, savingsGoals = [], budgets = [],
  canUseAISuggestions, t, locale, currency = DEFAULT_CURRENCY,
}: TransactionFormProps) => {
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [voiceParsing, setVoiceParsing] = useState(false);
  const { data: familyCategories = [] } = useFamilyCategories();
  const isFr = locale === 'fr';
  const speechLang = isFr ? 'fr-FR' : 'en-US';
  const voiceSupported = !!isSpeechRecognitionSupported();

  // Quick voice → AI parse: fills the whole form from a spoken sentence
  const quickVoice = useSpeechRecognition({
    lang: speechLang,
    onFinal: async (transcript) => {
      if (!transcript) return;
      setForm(f => ({ ...f, description: f.description ? `${f.description} ${transcript}` : transcript }));
      if (!canUseAISuggestions) return;
      setVoiceParsing(true);
      try {
        const data = await invokeAuthedEdgeFunction<any>('ai-quick-parse', {
          locale: isFr ? 'fr' : 'en',
          body: {
            input: transcript,
            categories: categories.map(c => ({ id: c.id, name: c.name, type: c.type })),
            accounts: accounts.map(a => ({ id: a.id, name: a.name })),
            locale,
          },
        });
        if (data && !data.error) {
          setForm(f => ({
            ...f,
            description: data.description || transcript,
            amount: data.amount ? String(data.amount) : f.amount,
            type: data.type === 'income' ? 'income' : 'expense',
            category_id: data.category_id || f.category_id,
            account_id: data.account_id || f.account_id,
          }));
          toast.success(isFr ? '🎙️ Saisie vocale interprétée' : '🎙️ Voice input parsed');
        }
      } catch (e: any) {
        toast.error(e?.message || (isFr ? 'Erreur IA vocale' : 'Voice AI error'));
      } finally {
        setVoiceParsing(false);
      }
    },
  });

  // Notes dictation: appends raw transcript to the notes field
  const notesVoice = useSpeechRecognition({
    lang: speechLang,
    onFinal: (transcript) => {
      setForm(f => {
        const next = f.notes ? `${f.notes} ${transcript}` : transcript;
        return { ...f, notes: next.slice(0, 500) };
      });
    },
  });

  const filteredCategories = categories.filter(c => c.type === form.type);
  const isTransfer = form.type === 'transfer';
  const showTransferTab = allowTransfer && !editing;

  // Auto-pre-fill category when picking a savings account linked to a budget.
  // Triggers on account_id change, only when category is empty and not editing.
  const lastAutoFilledForAccount = useRef<string>('');
  useEffect(() => {
    if (editing) return;
    if (!form.account_id) return;
    if (form.category_id) return;
    if (lastAutoFilledForAccount.current === form.account_id) return;

    const goal = (savingsGoals || []).find((g: any) => g.account_id === form.account_id);
    if (!goal) return;
    const budget = (budgets || []).find((b: any) => b.linked_savings_goal_id === goal.id);
    if (!budget?.category_id) return;

    // Only apply if category exists and matches current type
    const cat = categories.find(c => c.id === budget.category_id);
    if (!cat || cat.type !== form.type) return;

    lastAutoFilledForAccount.current = form.account_id;
    setForm(f => ({ ...f, category_id: budget.category_id }));
    toast.success(
      isFr
        ? `🏷️ Catégorie pré-remplie depuis le budget "${budget.name}"`
        : `🏷️ Category pre-filled from budget "${budget.name}"`,
      { duration: 2200 }
    );
  }, [form.account_id, form.category_id, form.type, editing, savingsGoals, budgets, categories, setForm, isFr]);

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
      const data = await invokeAuthedEdgeFunction<any>('ai-suggest', {
        locale: isFr ? 'fr' : 'en',
        body: {
          description: form.description, type: form.type,
          categories: categories.filter(c => c.type === form.type).map(c => ({ id: c.id, name: c.name })),
          accounts: accounts.map(a => ({ id: a.id, name: a.name })), locale,
        },
      });
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
      description={isTransfer ? t.transferDesc : t.fillTransactionDetails}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">{t.cancel}</Button>
          <Button
            className="text-primary-foreground rounded-xl min-w-[120px] shadow-md"
            style={{ background: 'var(--gradient-primary)' }}
            onClick={() => { if (isTransfer && onTransfer) onTransfer(); else onSave(); }}
            disabled={saving || (isTransfer && accounts.length < 2)}
          >
            {saving ? (locale === 'fr' ? 'Enregistrement...' : 'Saving...') : (isTransfer ? t.transfer : t.save)}
          </Button>
        </>
      }
    >
      <div className="space-y-4 py-2 form-animate">
        {/* Type selector */}
        <div className="space-y-2">
          <Label className="form-label">{t.type}</Label>
          <div className={`grid ${showTransferTab ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
            <motion.button type="button" onClick={() => setForm(f => ({ ...f, type: 'expense', category_id: '' }))}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${form.type === 'expense' ? 'border-destructive bg-destructive/10 text-destructive shadow-sm' : 'border-border bg-card text-muted-foreground hover:bg-muted/50'}`}>
              <TrendingDown className="w-4 h-4" />{t.expenseType}
            </motion.button>
            <motion.button type="button" onClick={() => setForm(f => ({ ...f, type: 'income', category_id: '' }))}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${form.type === 'income' ? 'border-secondary bg-secondary/10 text-secondary shadow-sm' : 'border-border bg-card text-muted-foreground hover:bg-muted/50'}`}>
              <TrendingUp className="w-4 h-4" />{t.incomeType}
            </motion.button>
            {showTransferTab && (
              <motion.button
                type="button"
                onClick={() => {
                  if (transferDisabledReason) { toast.error(transferDisabledReason); return; }
                  setForm(f => ({ ...f, type: 'transfer', category_id: '' }));
                }}
                whileHover={transferDisabledReason ? undefined : { scale: 1.02 }}
                whileTap={transferDisabledReason ? undefined : { scale: 0.98 }}
                disabled={!!transferDisabledReason && !isTransfer}
                aria-disabled={!!transferDisabledReason && !isTransfer}
                title={transferDisabledReason || undefined}
                className={`flex items-center justify-center gap-2 px-3 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${isTransfer ? 'border-primary bg-primary/10 text-primary shadow-sm' : 'border-border bg-card text-muted-foreground hover:bg-muted/50'} ${transferDisabledReason && !isTransfer ? 'opacity-50 cursor-not-allowed hover:bg-card' : ''}`}>
                <ArrowLeftRight className="w-4 h-4" />{t.transfer}
              </motion.button>
            )}
          </div>
        </div>

        {/* Amount & Date */}
        <div className="grid grid-cols-2 gap-4">
          <InputField
            type="number" min="0.01" step="0.01"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: (e.target as HTMLInputElement).value }))}
            prefix={currencySymbol(currency)}
            label={amountLabel(t.amount, currency)}
            error={errors.amount}
            placeholder={exampleAmount(currency, locale)}
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
            <Label className="form-label flex items-center gap-1.5">
              <FileText className="w-3 h-3" />{t.description}
              {isTransfer && <span className="text-muted-foreground/50 font-normal normal-case">({locale === 'fr' ? 'optionnel' : 'optional'})</span>}
            </Label>
            <div className="flex items-center gap-1">
              {voiceSupported && !isTransfer && (
                <VoiceMicButton
                  listening={quickVoice.listening}
                  loading={voiceParsing}
                  onClick={() => (quickVoice.listening ? quickVoice.stop() : quickVoice.start())}
                  title={isFr ? 'Saisie vocale (IA)' : 'Voice input (AI)'}
                />
              )}
              {canUseAISuggestions && !isTransfer && (
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs rounded-lg text-primary" onClick={handleAISuggest} disabled={aiSuggesting}>
                  <Sparkles className="w-3 h-3 mr-1" />{aiSuggesting ? t.aiSuggesting : t.aiSuggest}
                </Button>
              )}
            </div>
          </div>
          {(quickVoice.listening || quickVoice.interim) && (
            <div className="flex items-center gap-2 text-xs text-primary bg-primary/5 border border-primary/20 rounded-lg px-2.5 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
              </span>
              <span className="truncate">
                {quickVoice.interim || (isFr ? 'Parlez maintenant…' : 'Speak now…')}
              </span>
            </div>
          )}
          {quickVoice.error === 'not-allowed' && (
            <p className="text-[11px] text-destructive">
              {isFr ? 'Microphone refusé. Autorisez-le dans le navigateur.' : 'Microphone denied. Allow it in your browser.'}
            </p>
          )}
          <Input value={form.description} maxLength={200}
            onChange={e => { setForm(f => ({ ...f, description: e.target.value })); setShowSuggestions(true); }}
            onBlur={() => {
              setTimeout(() => setShowSuggestions(false), 200);
              if (canUseAISuggestions && form.description.trim().length >= 3 && !form.category_id && !aiSuggesting) {
                (async () => {
                  try {
                      const data = await invokeAuthedEdgeFunction<any>('ai-categorize', {
                        locale: isFr ? 'fr' : 'en',
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

        {!isTransfer && (
          <>
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
          </>
        )}

        {isTransfer && (
          <>
            <div className="space-y-2">
              <Label className="form-label flex items-center gap-1.5"><CreditCard className="w-3 h-3" />{t.fromAccount}</Label>
              <AccountCombobox
                accounts={accounts}
                value={form.from_account_id || ''}
                onValueChange={v => setForm(f => ({ ...f, from_account_id: v }))}
                placeholder={t.selectAccount}
                error={!!errors.from_account_id}
              />
              {errors.from_account_id && <p className="text-xs text-destructive">{errors.from_account_id}</p>}
            </div>
            <div className="flex justify-center -my-1 text-muted-foreground">
              <ArrowRight className="w-4 h-4" />
            </div>
            <div className="space-y-2">
              <Label className="form-label flex items-center gap-1.5"><CreditCard className="w-3 h-3" />{t.toAccount}</Label>
              <AccountCombobox
                accounts={accounts}
                value={form.to_account_id || ''}
                onValueChange={v => setForm(f => ({ ...f, to_account_id: v }))}
                placeholder={t.selectAccount}
                excludeId={form.from_account_id}
                error={!!errors.to_account_id}
              />
              {errors.to_account_id && <p className="text-xs text-destructive">{errors.to_account_id}</p>}
            </div>
            {accounts.length < 2 && (
              <p className="text-xs text-destructive">{locale === 'fr' ? 'Crée au moins 2 comptes pour transférer' : 'Create at least 2 accounts to transfer'}</p>
            )}
          </>
        )}

        {/* Family Category — Privacy by Design (not for transfers) */}
        {!isTransfer && familyCategories.length > 0 && (
          <div className="space-y-2">
            <Label className="form-label flex items-center gap-1.5">
              <Users className="w-3 h-3" />
              {isFr ? 'Catégorie Famille' : 'Family category'}
              <span className="text-muted-foreground/50 font-normal normal-case">({isFr ? 'optionnel' : 'optional'})</span>
            </Label>
            <Select
              value={form.family_category_id || '__none__'}
              onValueChange={(v) => setForm(f => ({ ...f, family_category_id: v === '__none__' ? '' : v }))}
            >
              <SelectTrigger className="rounded-xl h-11">
                <SelectValue placeholder={isFr ? 'Privée — non partagée' : 'Private — not shared'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <span className="flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                    {isFr ? 'Privée — visible uniquement par moi' : 'Private — visible only to me'}
                  </span>
                </SelectItem>
                {familyCategories.map((fc) => (
                  <SelectItem key={fc.id} value={fc.id}>
                    <span className="flex items-center gap-2">
                      <span>{fc.icon}</span>
                      <span>{fc.name}</span>
                      {fc.group_name && <span className="text-[10px] text-muted-foreground">· {fc.group_name}</span>}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.family_category_id ? (
              <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary border-primary/20">
                <Users className="w-3 h-3" />
                {isFr ? 'Visible par votre famille' : 'Visible to your family'}
              </Badge>
            ) : (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Lock className="w-3 h-3" />
                {isFr ? 'Cette transaction reste privée' : 'This transaction stays private'}
              </p>
            )}
          </div>
        )}

        {/* Notes with char counter */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="form-label flex items-center gap-1.5">
              <StickyNote className="w-3 h-3" />
              {t.notes} <span className="text-muted-foreground/50 font-normal normal-case">({locale === 'fr' ? 'optionnel' : 'optional'})</span>
            </Label>
            <div className="flex items-center gap-2">
              {form.notes && (
                <span className={`text-[10px] tabular-nums ${form.notes.length > 450 ? 'text-destructive' : 'text-muted-foreground/50'}`}>
                  {form.notes.length}/500
                </span>
              )}
              {voiceSupported && (
                <VoiceMicButton
                  listening={notesVoice.listening}
                  onClick={() => (notesVoice.listening ? notesVoice.stop() : notesVoice.start())}
                  title={isFr ? 'Dicter une note' : 'Dictate a note'}
                />
              )}
            </div>
          </div>
          <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} maxLength={500} rows={2}
            className={`rounded-xl resize-none ${errors.notes ? 'border-destructive' : ''}`} placeholder={locale === 'fr' ? 'Ajoutez une note...' : 'Add a note...'} />
          {(notesVoice.listening || notesVoice.interim) && (
            <div className="text-[11px] text-primary flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-destructive" />
              </span>
              <span className="italic truncate">{notesVoice.interim || (isFr ? 'Dictée en cours…' : 'Listening…')}</span>
            </div>
          )}
          {errors.notes && <p className="text-xs text-destructive">{errors.notes}</p>}
        </div>
      </div>
    </ResponsiveFormDialog>
  );
};
