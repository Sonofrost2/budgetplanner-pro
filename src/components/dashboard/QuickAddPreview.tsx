import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Check, Pencil, X, Loader2, TrendingDown, TrendingUp, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { QuickParsedTransaction } from '@/components/dashboard/transactions/TransactionsHeroHeader';

interface Props {
  initial: QuickParsedTransaction;
  locale: 'fr' | 'en';
  onCancel: () => void;
  onConfirmed: () => void;
  onEditAdvanced: (values: QuickParsedTransaction) => void;
}

/**
 * Inline preview of an AI-parsed transaction.
 * Shows editable fields (type, description, amount, category, account, date)
 * so the user can review and adjust BEFORE saving.
 *
 * - "Confirmer" → inserts the transaction directly and toasts success.
 * - "Modifier davantage" → hands off to the full form dialog (advanced fields).
 * - Transfers are always routed to the advanced form (needs 2 accounts + RPC).
 */
export const QuickAddPreview = ({ initial, locale, onCancel, onConfirmed, onEditAdvanced }: Props) => {
  const isFr = locale === 'fr';
  const { user } = useAuth();
  const [type, setType] = useState<'expense' | 'income' | 'transfer'>(initial.type || 'expense');
  const [description, setDescription] = useState(initial.description || '');
  const [amount, setAmount] = useState<string>(initial.amount != null ? String(initial.amount) : '');
  const [categoryId, setCategoryId] = useState<string>(initial.category_id || '');
  const [accountId, setAccountId] = useState<string>(initial.account_id || '');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['quickadd-categories', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('categories')
        .select('id, name, type, icon')
        .is('deleted_at', null)
        .order('name');
      return data ?? [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['quickadd-accounts', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('payment_accounts')
        .select('id, name')
        .is('deleted_at', null)
        .eq('status', 'active')
        .order('name');
      return data ?? [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const filteredCats = useMemo(
    () => categories.filter((c: any) => c.type === type),
    [categories, type]
  );

  // Ensure category is valid for the current type.
  useEffect(() => {
    if (type === 'transfer') return;
    if (!categoryId || !filteredCats.some((c: any) => c.id === categoryId)) {
      setCategoryId(filteredCats[0]?.id || '');
    }
  }, [type, filteredCats, categoryId]);

  useEffect(() => {
    if (!accountId && accounts[0]) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  const isTransfer = type === 'transfer';
  const amountNum = Number(amount);
  const canConfirm = !isTransfer
    && !!description.trim()
    && Number.isFinite(amountNum)
    && amountNum > 0
    && !!categoryId
    && !!accountId;

  const buildValues = (): QuickParsedTransaction => ({
    description: description.trim(),
    amount: Number.isFinite(amountNum) ? amountNum : 0,
    type,
    category_id: categoryId || undefined,
    account_id: accountId || undefined,
    from_account_id: initial.from_account_id,
    to_account_id: initial.to_account_id,
    confidence: initial.confidence,
  });

  const handleConfirm = async () => {
    if (!user || !canConfirm || saving) return;
    setSaving(true);
    const { error } = await supabase.from('transactions').insert({
      user_id: user.id,
      description: description.trim(),
      amount: amountNum,
      type,
      category_id: categoryId || null,
      account_id: accountId || null,
      date,
      notes: null,
    });
    setSaving(false);
    if (error) {
      toast.error(
        isFr
          ? `Impossible d'enregistrer : ${error.message}`
          : `Could not save: ${error.message}`
      );
      return;
    }
    toast.success(isFr ? '✅ 1 transaction ajoutée' : '✅ 1 transaction added');
    onConfirmed();
  };

  const typeChip = (
    value: 'expense' | 'income' | 'transfer',
    label: string,
    Icon: typeof TrendingDown
  ) => (
    <button
      key={value}
      type="button"
      onClick={() => setType(value)}
      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
        type === value
          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
          : 'bg-background/60 text-muted-foreground border-border/40 hover:border-primary/40'
      }`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="mt-2 rounded-xl border border-primary/25 bg-background/70 backdrop-blur-sm p-3 sm:p-4 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
            <Sparkles className="w-3 h-3 text-primary-foreground" />
          </div>
          <p className="text-xs font-semibold truncate">
            {isFr ? 'Vérifie et confirme' : 'Review and confirm'}
            {typeof initial.confidence === 'number' && (
              <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                {isFr ? 'confiance' : 'confidence'} · {Math.round(initial.confidence * 100)}%
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {typeChip('expense', isFr ? 'Dépense' : 'Expense', TrendingDown)}
          {typeChip('income', isFr ? 'Revenu' : 'Income', TrendingUp)}
          {typeChip('transfer', isFr ? 'Transfert' : 'Transfer', ArrowLeftRight)}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-[10px] text-muted-foreground">{isFr ? 'Description' : 'Description'}</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={isFr ? 'Ex: Café' : 'e.g. Coffee'}
            className="h-8 text-sm rounded-lg"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">{isFr ? 'Montant' : 'Amount'}</Label>
          <Input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="h-8 text-sm rounded-lg tabular-nums"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">{isFr ? 'Date' : 'Date'}</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-8 text-sm rounded-lg"
          />
        </div>
        {!isTransfer && (
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">{isFr ? 'Catégorie' : 'Category'}</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="h-8 text-sm rounded-lg">
                <SelectValue placeholder={isFr ? 'Choisir' : 'Select'} />
              </SelectTrigger>
              <SelectContent>
                {filteredCats.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.icon ? `${c.icon} ` : ''}{c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">{isFr ? 'Compte' : 'Account'}</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger className="h-8 text-sm rounded-lg">
              <SelectValue placeholder={isFr ? 'Choisir' : 'Select'} />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a: any) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isTransfer && (
        <p className="text-[11px] text-muted-foreground italic">
          {isFr
            ? 'Les transferts nécessitent 2 comptes — utilise « Modifier davantage ».'
            : 'Transfers need 2 accounts — use "Edit more".'}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCancel}
          className="h-8 rounded-lg text-xs"
        >
          <X className="w-3.5 h-3.5 mr-1" />
          {isFr ? 'Annuler' : 'Cancel'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onEditAdvanced(buildValues())}
          className="h-8 rounded-lg text-xs"
        >
          <Pencil className="w-3.5 h-3.5 mr-1" />
          {isFr ? 'Modifier davantage' : 'Edit more'}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleConfirm}
          disabled={!canConfirm || saving}
          className="h-8 rounded-lg text-xs text-primary-foreground"
          style={{ background: 'var(--gradient-primary)' }}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
          {isFr ? 'Confirmer' : 'Confirm'}
        </Button>
      </div>
    </motion.div>
  );
};