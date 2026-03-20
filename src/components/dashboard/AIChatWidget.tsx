import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, X, Send, Sparkles, Loader2, Trash2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

type Msg = { role: 'user' | 'assistant'; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

const AIChatWidget = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { currency } = useProfile();
  const t = dashT[locale];
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [context, setContext] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch enriched user context on first open
  const fetchContext = useCallback(async () => {
    if (!user || context) return;
    try {
      const [accRes, budRes, savRes, txRes, profRes, debtRes, recRes] = await Promise.all([
        supabase.from('payment_accounts').select('name, type, real_balance, opening_balance, icon').eq('user_id', user.id),
        supabase.from('budgets').select('name, amount, period, budget_type, control_type, alert_threshold, category_id, categories(name)').eq('user_id', user.id),
        supabase.from('savings_goals').select('name, current_amount, target_amount, interest_rate, bank_name, deadline, monthly_contribution, is_locked, start_date').eq('user_id', user.id),
        supabase.from('transactions').select('amount, type, category_id, date, description, categories(name)').eq('user_id', user.id).order('date', { ascending: false }).limit(100),
        supabase.from('profiles').select('display_name, currency, locale').eq('user_id', user.id).single(),
        supabase.from('debts').select('creditor_name, total_amount, paid_amount, due_date, notes').eq('user_id', user.id),
        supabase.from('recurring_transactions').select('description, amount, type, frequency, next_date, active, categories(name)').eq('user_id', user.id).eq('active', true),
      ]);

      // Compute summary stats
      const transactions = txRes.data || [];
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthTxs = transactions.filter(tx => tx.date?.startsWith(thisMonth));
      const monthIncome = monthTxs.filter(tx => tx.type === 'income').reduce((s, tx) => s + Number(tx.amount), 0);
      const monthExpenses = monthTxs.filter(tx => tx.type === 'expense').reduce((s, tx) => s + Number(tx.amount), 0);

      const accounts = accRes.data || [];
      const totalBalance = accounts.reduce((s, a) => s + Number(a.real_balance), 0);

      const debts = debtRes.data || [];
      const totalDebt = debts.reduce((s, d) => s + (Number(d.total_amount) - Number(d.paid_amount)), 0);

      const savings = savRes.data || [];
      const totalSaved = savings.reduce((s, g) => s + Number(g.current_amount), 0);
      const totalTarget = savings.reduce((s, g) => s + Number(g.target_amount), 0);

      setContext({
        summary: {
          totalBalance,
          monthIncome,
          monthExpenses,
          savingsRate: monthIncome > 0 ? Math.round(((monthIncome - monthExpenses) / monthIncome) * 100) : 0,
          totalDebt,
          totalSaved,
          totalSavingsTarget: totalTarget,
          accountCount: accounts.length,
          budgetCount: (budRes.data || []).length,
        },
        accounts: accounts.map(a => ({ name: a.name, type: a.type, balance: a.real_balance, icon: a.icon })),
        budgets: (budRes.data || []).map(b => ({ name: b.name, amount: b.amount, period: b.period, type: b.budget_type, category: (b.categories as any)?.name })),
        savings: savings.map(s => ({ name: s.name, current: s.current_amount, target: s.target_amount, rate: s.interest_rate, bank: s.bank_name, deadline: s.deadline, monthly: s.monthly_contribution, locked: s.is_locked })),
        debts: debts.map(d => ({ creditor: d.creditor_name, total: d.total_amount, paid: d.paid_amount, remaining: Number(d.total_amount) - Number(d.paid_amount), dueDate: d.due_date })),
        recurring: (recRes.data || []).map(r => ({ description: r.description, amount: r.amount, type: r.type, frequency: r.frequency, nextDate: r.next_date, category: (r.categories as any)?.name })),
        recentTransactions: transactions.slice(0, 30).map(tx => ({ amount: tx.amount, type: tx.type, date: tx.date, description: tx.description, category: (tx.categories as any)?.name })),
        profile: profRes.data,
        currency,
        locale,
      });
    } catch { /* ignore */ }
  }, [user, context, currency, locale]);

  useEffect(() => {
    if (open) {
      fetchContext();
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open, fetchContext]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const streamChat = async (allMessages: Msg[]) => {
    const resp = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages: allMessages, context }),
    });

    if (resp.status === 429) { toast.error(locale === 'fr' ? 'Trop de requêtes, réessayez.' : 'Too many requests, try again.'); throw new Error('Rate limited'); }
    if (resp.status === 402) { toast.error(locale === 'fr' ? 'Crédits IA épuisés.' : 'AI credits exhausted.'); throw new Error('Payment required'); }
    if (!resp.ok || !resp.body) throw new Error('Stream failed');

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let assistantSoFar = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf('\n')) !== -1) {
        let line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.endsWith('\r')) line = line.slice(0, -1);
        if (!line.startsWith('data: ')) continue;
        const json = line.slice(6).trim();
        if (json === '[DONE]') return;
        try {
          const parsed = JSON.parse(json);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            assistantSoFar += content;
            setMessages(prev => {
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant') {
                return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
              }
              return [...prev, { role: 'assistant', content: assistantSoFar }];
            });
          }
        } catch { buffer = line + '\n' + buffer; break; }
      }
    }
  };

  const send = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || isLoading) return;
    const userMsg: Msg = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    try {
      await streamChat([...messages, userMsg]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshContext = () => {
    setContext(null);
    setTimeout(() => fetchContext(), 100);
    toast.success(locale === 'fr' ? 'Contexte actualisé' : 'Context refreshed');
  };

  const suggestionsFr = [
    '📊 Analyse mon mois en cours',
    '💡 Comment réduire mes dépenses ?',
    '🏦 Quels investissements pour moi ?',
    '📋 Bilan financier complet',
    '🎯 Optimiser mon épargne',
    '💳 Plan de remboursement dettes',
  ];
  const suggestionsEn = [
    '📊 Analyze my current month',
    '💡 How to reduce my expenses?',
    '🏦 What investments for me?',
    '📋 Full financial review',
    '🎯 Optimize my savings',
    '💳 Debt repayment plan',
  ];
  const suggestions = locale === 'fr' ? suggestionsFr : suggestionsEn;

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!open && (
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <Button
              onClick={() => setOpen(true)}
              className="h-14 w-14 rounded-full shadow-lg text-primary-foreground"
              style={{ background: 'var(--gradient-primary)' }}
            >
              <Sparkles className="w-6 h-6" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 w-[400px] max-w-[calc(100vw-2rem)] h-[580px] max-h-[calc(100vh-6rem)] flex flex-col rounded-2xl border border-border/50 shadow-xl bg-background overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50" style={{ background: 'var(--gradient-primary)' }}>
              <div className="flex items-center gap-2 text-primary-foreground">
                <Sparkles className="w-5 h-5" />
                <span className="font-bold text-sm">{locale === 'fr' ? 'Conseiller IA' : 'AI Advisor'}</span>
                {context && <span className="text-[10px] opacity-70 bg-primary-foreground/20 px-1.5 py-0.5 rounded-full">{locale === 'fr' ? 'Contexte chargé' : 'Context loaded'}</span>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10" onClick={refreshContext} title={locale === 'fr' ? 'Actualiser les données' : 'Refresh data'}>
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10" onClick={() => { setMessages([]); setContext(null); }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10" onClick={() => setOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {locale === 'fr'
                        ? '👋 Bonjour ! Je suis votre conseiller financier IA. J\'ai accès à vos comptes, budgets, épargne, dettes et transactions pour des conseils personnalisés.'
                        : '👋 Hi! I\'m your AI financial advisor. I have access to your accounts, budgets, savings, debts and transactions for personalized advice.'}
                    </p>
                    {context?.summary && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-muted/30 rounded-lg p-2">
                          <span className="text-muted-foreground">{locale === 'fr' ? 'Solde total' : 'Total balance'}</span>
                          <p className="font-bold text-foreground">{Math.round(context.summary.totalBalance).toLocaleString()}</p>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-2">
                          <span className="text-muted-foreground">{locale === 'fr' ? 'Taux épargne' : 'Savings rate'}</span>
                          <p className="font-bold text-foreground">{context.summary.savingsRate}%</p>
                        </div>
                        {context.summary.totalDebt > 0 && (
                          <div className="bg-destructive/10 rounded-lg p-2">
                            <span className="text-muted-foreground">{locale === 'fr' ? 'Dettes restantes' : 'Remaining debt'}</span>
                            <p className="font-bold text-destructive">{Math.round(context.summary.totalDebt).toLocaleString()}</p>
                          </div>
                        )}
                        <div className="bg-muted/30 rounded-lg p-2">
                          <span className="text-muted-foreground">{locale === 'fr' ? 'Épargne cumulée' : 'Total savings'}</span>
                          <p className="font-bold text-foreground">{Math.round(context.summary.totalSaved).toLocaleString()}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {suggestions.map(s => (
                      <button key={s} onClick={() => send(s)} className="text-xs px-3 py-1.5 rounded-full border border-border/50 bg-muted/30 hover:bg-muted/60 text-foreground transition-colors">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-md'
                      : 'bg-muted/50 text-foreground rounded-bl-md'
                  }`}>
                    {m.role === 'assistant' ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-1.5 [&>ul]:mb-1.5 [&>ol]:mb-1.5 [&>h1]:text-base [&>h2]:text-sm [&>h3]:text-sm">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    ) : m.content}
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="flex justify-start">
                  <div className="bg-muted/50 rounded-2xl rounded-bl-md px-4 py-3">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>

            {/* Quick follow-up suggestions after assistant response */}
            {messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && !isLoading && (
              <div className="px-3 pb-1 flex gap-1.5 overflow-x-auto">
                {(locale === 'fr'
                  ? ['Détaille davantage', 'Et pour mon épargne ?', 'Quels risques ?']
                  : ['More details', 'What about savings?', 'What are the risks?']
                ).map(s => (
                  <button key={s} onClick={() => send(s)} className="text-[11px] px-2.5 py-1 rounded-full border border-border/50 bg-muted/20 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap shrink-0">
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <form onSubmit={e => { e.preventDefault(); send(); }} className="p-3 border-t border-border/50 flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={locale === 'fr' ? 'Posez votre question...' : 'Ask your question...'}
                className="flex-1 rounded-xl text-sm h-9"
                disabled={isLoading}
              />
              <Button type="submit" size="icon" className="h-9 w-9 rounded-xl text-primary-foreground" style={{ background: 'var(--gradient-primary)' }} disabled={isLoading || !input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AIChatWidget;
