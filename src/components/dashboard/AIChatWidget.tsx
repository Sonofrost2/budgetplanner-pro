import { formatNumber } from '@/lib/currency';
import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Sparkles, Loader2, Trash2, RotateCcw, History, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { coachToast } from '@/lib/coachToast';
import { useAIConversations, type AIMessage } from '@/hooks/useAIConversations';
import { AICoachAvatar } from './ai/AICoachAvatar';
import { AIMessageBubble } from './ai/AIMessageBubble';
import { AIQuickPrompts } from './ai/AIQuickPrompts';
import { AIConversationList } from './ai/AIConversationList';
import { isLiveGoal, isLiveAccount, liveSavingsTotal } from '@/lib/savingsLogic';
import { annualizeRate, annualInterestCost } from '@/lib/financialNormalization';

type Msg = { role: 'user' | 'assistant'; content: string; created_at?: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

const QUICK_PROMPTS_FR = [
  '📊 Fais le bilan de mes finances ce mois',
  '💰 Comment optimiser mon épargne ?',
  '🎯 Stratégie pour rembourser mes dettes',
  '🔮 Que prévoir pour les 3 prochains mois ?',
];
const QUICK_PROMPTS_EN = [
  '📊 Review my finances this month',
  '💰 How to optimize my savings?',
  '🎯 Strategy to pay off my debts',
  '🔮 What to expect for the next 3 months?',
];

const buildFollowUps = (last: string, locale: 'fr' | 'en'): string[] => {
  const text = last.toLowerCase();
  const fr = locale === 'fr';
  const out: string[] = [];
  if (/épargn|savings/.test(text)) out.push(fr ? '🎯 Simule un objectif d\'épargne' : '🎯 Simulate a savings goal');
  if (/dette|debt/.test(text)) out.push(fr ? '💳 Plan de remboursement détaillé' : '💳 Detailed repayment plan');
  if (/budget|cadre/.test(text)) out.push(fr ? '📊 Analyse mes dépassements' : '📊 Analyze my overshoots');
  if (/investis|invest/.test(text)) out.push(fr ? '⚖️ Compare risque vs rendement' : '⚖️ Risk vs return');
  if (out.length < 2) out.push(fr ? '✨ Donne-moi une action prioritaire' : '✨ Give me one priority action');
  if (out.length < 3) out.push(fr ? '📈 Projection sur 6 mois' : '📈 6-month projection');
  return out.slice(0, 3);
};

import { useSubscription } from '@/hooks/useSubscription';
import { Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

const AIChatWidget = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { currency } = useProfile();
  const { canUseChatCoach } = useSubscription();
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [context, setContext] = useState<any>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showJump, setShowJump] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { conversations, refresh, loadMessages, archiveConversation, deleteConversation } = useAIConversations();

  const fetchContext = useCallback(async () => {
    if (!user || context) return;
    try {
      const [accRes, budRes, savRes, txRes, profRes, debtRes, recRes, healthRes] = await Promise.all([
        supabase.from('payment_accounts').select('name, type, real_balance, opening_balance, icon, status, archived_at, deleted_at').eq('user_id', user.id).is('deleted_at', null).is('archived_at', null),
        supabase.from('budgets').select('name, amount, period, budget_type, control_type, alert_threshold, category_id, categories(name)').eq('user_id', user.id),
        supabase.from('savings_goals').select('name, current_amount, target_amount, interest_rate, interest_frequency, bank_name, deadline, monthly_contribution, is_locked, status, paused_at, deleted_at').eq('user_id', user.id).is('deleted_at', null),
        supabase.from('transactions').select('amount, type, category_id, date, description, categories(name)').eq('user_id', user.id).order('date', { ascending: false }).limit(80),
        supabase.from('profiles').select('display_name, currency, locale').eq('user_id', user.id).single(),
        supabase.from('debts').select('creditor_name, total_amount, paid_amount, due_date, interest_rate, interest_type').eq('user_id', user.id),
        supabase.from('recurring_transactions').select('description, amount, type, frequency, next_date, active, categories(name)').eq('user_id', user.id).eq('active', true),
        supabase.rpc('compute_health_score', { p_user_id: user.id }),
      ]);

      const transactions = txRes.data || [];
      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthTxs = transactions.filter(tx => tx.date?.startsWith(thisMonth));
      const monthIncome = monthTxs.filter(tx => tx.type === 'income').reduce((s, tx) => s + Number(tx.amount), 0);
      const monthExpenses = monthTxs.filter(tx => tx.type === 'expense').reduce((s, tx) => s + Number(tx.amount), 0);

      const accounts = (accRes.data || []).filter(isLiveAccount);
      const totalBalance = accounts.reduce((s, a) => s + Number(a.real_balance), 0);

      const debts = debtRes.data || [];
      const totalDebt = debts.reduce((s, d) => s + (Number(d.total_amount) - Number(d.paid_amount)), 0);

      // Filter to live goals so the AI Coach reasons over the user's actual
      // active savings — not on completed/paused/archived ones.
      const savings = (savRes.data || []).filter(isLiveGoal);
      const totalSaved = liveSavingsTotal(savings);

      // Top 5 expense categories this month
      const catTotals: Record<string, number> = {};
      monthTxs.filter(tx => tx.type === 'expense').forEach(tx => {
        const name = (tx.categories as any)?.name || 'Autre';
        catTotals[name] = (catTotals[name] || 0) + Number(tx.amount);
      });
      const topCategories = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n, v]) => ({ name: n, total: v }));

      setContext({
        summary: {
          totalBalance, monthIncome, monthExpenses,
          savingsRate: monthIncome > 0 ? Math.round(((monthIncome - monthExpenses) / monthIncome) * 100) : 0,
          totalDebt, totalSaved, accountCount: accounts.length, budgetCount: (budRes.data || []).length,
          healthScore: (healthRes.data as any)?.score,
        },
        topCategoriesThisMonth: topCategories,
        accounts: accounts.map(a => ({ name: a.name, type: a.type, balance: a.real_balance })),
        budgets: (budRes.data || []).map(b => ({ name: b.name, amount: b.amount, period: b.period, type: b.budget_type, category: (b.categories as any)?.name })),
        // ⚠️ Tous les taux sont ANNUALISÉS avant l'envoi pour que l'IA
        // puisse comparer des objectifs/dettes ayant des fréquences
        // d'intérêt différentes (mensuel vs trimestriel vs annuel).
        savings: savings.map(s => ({
          name: s.name,
          current: s.current_amount,
          target: s.target_amount,
          monthlyContribution: (s as any).monthly_contribution,
          rateAnnualizedPct: annualizeRate(Number((s as any).interest_rate) || 0, (s as any).interest_frequency),
          rateRawPct: (s as any).interest_rate,
          rateFrequency: (s as any).interest_frequency || 'yearly',
          deadline: s.deadline,
          isLocked: (s as any).is_locked,
        })),
        debts: debts.map(d => {
          const remaining = Number(d.total_amount) - Number(d.paid_amount);
          const annualRate = annualizeRate(Number((d as any).interest_rate) || 0, 'yearly');
          return {
            creditor: d.creditor_name,
            total: d.total_amount,
            paid: d.paid_amount,
            remaining,
            dueDate: d.due_date,
            rateAnnualizedPct: annualRate,
            interestType: (d as any).interest_type || 'simple',
            annualInterestCost: annualInterestCost(remaining, annualRate, (d as any).interest_type),
          };
        }),
        recurring: (recRes.data || []).map(r => ({ description: r.description, amount: r.amount, type: r.type, frequency: r.frequency, nextDate: r.next_date })),
        recentTransactions: transactions.slice(0, 25).map(tx => ({ amount: tx.amount, type: tx.type, date: tx.date, description: tx.description, category: (tx.categories as any)?.name })),
        profile: profRes.data, currency, locale,
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
    if (!showJump) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, showJump]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setShowJump(!atBottom);
  };

  const streamChat = async (allMessages: Msg[]) => {
    // Get the current user's session token — sending the publishable anon key
    // here would make requirePlan() fail with "missing sub claim" (403).
    const getToken = async (forceRefresh = false): Promise<string | null> => {
      if (forceRefresh) {
        const { data, error } = await supabase.auth.refreshSession();
        if (error || !data?.session?.access_token) return null;
        return data.session.access_token;
      }
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token ?? null;
    };

    let token = await getToken();
    if (!token) {
      coachToast.fail(locale === 'fr' ? 'Session expirée. Reconnecte-toi.' : 'Session expired. Please sign in again.');
      throw new Error('No session');
    }

    const doFetch = (jwt: string) => fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        messages: allMessages.map(({ role, content }) => ({ role, content })),
        context,
        conversationId,
      }),
    });

    let resp = await doFetch(token);

    // Retry once on 401/Unauthorized after refreshing the JWT
    if (resp.status === 401) {
      const refreshed = await getToken(true);
      if (refreshed) {
        token = refreshed;
        resp = await doFetch(refreshed);
      }
    }

    if (!resp.ok) {
      let errorMessage = locale === 'fr' ? 'Erreur du service IA' : 'AI service error';
      try {
        const payload = await resp.json();
        errorMessage = payload?.error || errorMessage;
      } catch {
        // ignore invalid JSON error body
      }

      // Localize auth failures (401/403) — never surface raw "Unauthorized"
      // / "Missing authorization header" / "invalid JWT" strings to the user.
      const looksAuth =
        resp.status === 401 ||
        resp.status === 403 ||
        /unauthor|missing auth|invalid (jwt|token)|jwt expired|sub claim/i.test(errorMessage);
      if (looksAuth) {
        const sessionExpired = locale === 'fr'
          ? 'Session expirée. Reconnecte-toi pour continuer à discuter avec le Coach.'
          : 'Session expired. Please sign in again to continue chatting with the Coach.';
        coachToast.fail(sessionExpired);
        throw new Error('auth_expired');
      }

      coachToast.fail(errorMessage);
      if (resp.status === 429) throw new Error('Rate limited');
      if (resp.status === 402) throw new Error('Payment required');
      throw new Error(errorMessage);
    }

    if (!resp.body) {
      coachToast.fail(locale === 'fr' ? 'Flux IA indisponible' : 'AI stream unavailable');
      throw new Error('Stream failed');
    }

    const newConvId = resp.headers.get('x-conversation-id');
    if (newConvId && newConvId !== conversationId) setConversationId(newConvId);

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = ''; let assistantSoFar = '';

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
              return [...prev, { role: 'assistant', content: assistantSoFar, created_at: new Date().toISOString() }];
            });
          }
        } catch { buffer = line + '\n' + buffer; break; }
      }
    }
  };

  const send = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || isLoading) return;
    const userMsg: Msg = { role: 'user', content: msg, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    try {
      await streamChat([...messages, userMsg]);
      setTimeout(() => refresh(), 600); // refresh sidebar (title may have updated)
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshContext = () => {
    setContext(null);
    setTimeout(() => fetchContext(), 100);
    coachToast.saved(locale === 'fr' ? 'Contexte actualisé' : 'Context refreshed');
  };

  const newConversation = () => {
    setMessages([]);
    setConversationId(null);
    setShowHistory(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const openConversation = async (id: string) => {
    setConversationId(id);
    setShowHistory(false);
    const msgs = await loadMessages(id);
    setMessages(msgs.filter(m => m.role !== 'system').map((m: AIMessage) => ({
      role: m.role as 'user' | 'assistant', content: m.content, created_at: m.created_at,
    })));
  };

  const handleArchive = async (id: string) => {
    await archiveConversation(id);
    if (id === conversationId) newConversation();
    coachToast.warn(locale === 'fr' ? 'Conversation archivée' : 'Conversation archived');
  };

  const handleDelete = async (id: string) => {
    await deleteConversation(id);
    if (id === conversationId) newConversation();
    coachToast.warn(locale === 'fr' ? 'Conversation supprimée' : 'Conversation deleted');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')?.content || '';
  const followUps = lastAssistant ? buildFollowUps(lastAssistant, locale) : [];
  const quickPrompts = locale === 'fr' ? QUICK_PROMPTS_FR : QUICK_PROMPTS_EN;

  return (
    <>
      {/* Floating action button */}
      <AnimatePresence>
        {!open && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <div className="relative group">
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ background: 'var(--gradient-primary)' }}
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2.4, repeat: Infinity }}
              />
              {canUseChatCoach ? (
                <Button
                  onClick={() => setOpen(true)}
                  className="relative h-14 w-14 rounded-full shadow-xl text-primary-foreground"
                  style={{ background: 'var(--gradient-primary)' }}
                >
                  <Sparkles className="w-6 h-6" />
                </Button>
              ) : (
                <Link to="/dashboard/payment">
                  <Button
                    className="relative h-14 w-14 rounded-full shadow-xl text-primary-foreground"
                    style={{ background: 'var(--gradient-primary)' }}
                    title={locale === 'fr' ? 'Coach IA — Plan Pro/Premium' : 'AI Coach — Pro/Premium plan'}
                  >
                    <Lock className="w-5 h-5" />
                  </Button>
                </Link>
              )}
              <span className="absolute -top-1 -right-1 text-[10px] bg-accent text-accent-foreground rounded-full h-5 w-5 flex items-center justify-center font-bold animate-pulse">✨</span>
              <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap text-xs bg-foreground text-background px-2 py-1 rounded-md shadow-lg">
                {locale === 'fr' ? 'Coach IA' : 'AI Coach'}
              </div>
            </div>
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
            className="fixed bottom-6 right-6 z-50 w-[480px] max-w-[calc(100vw-2rem)] h-[640px] max-h-[calc(100vh-6rem)] flex rounded-2xl border border-border/40 shadow-2xl bg-background/95 backdrop-blur-xl overflow-hidden"
          >
            {/* Decorative blob */}
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-20 blur-3xl pointer-events-none" style={{ background: 'var(--gradient-primary)' }} />
            <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full opacity-10 blur-3xl pointer-events-none bg-accent" />

            {/* Sidebar */}
            <AnimatePresence>
              {showHistory && (
                <motion.div initial={{ width: 0 }} animate={{ width: 'auto' }} exit={{ width: 0 }} className="overflow-hidden">
                  <AIConversationList
                    conversations={conversations}
                    activeId={conversationId}
                    onSelect={openConversation}
                    onNew={newConversation}
                    onArchive={handleArchive}
                    onDelete={handleDelete}
                    locale={locale as 'fr' | 'en'}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main column */}
            <div className="flex-1 flex flex-col relative z-10 min-w-0">
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/40" style={{ background: 'var(--gradient-primary)' }}>
                <div className="flex items-center gap-2.5 text-primary-foreground min-w-0">
                  <AICoachAvatar size="sm" pulsing />
                  <div className="min-w-0">
                    <p className="font-bold text-sm leading-tight">{locale === 'fr' ? 'Coach Financier' : 'Financial Coach'}</p>
                    <p className="text-[10px] opacity-80 leading-tight">{locale === 'fr' ? 'Votre conseiller dédié' : 'Your dedicated advisor'}</p>
                  </div>
                </div>
                <div className="flex gap-0.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/15" onClick={() => setShowHistory(s => !s)} title={locale === 'fr' ? 'Historique' : 'History'}>
                    <History className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/15" onClick={refreshContext} title={locale === 'fr' ? 'Rafraîchir contexte' : 'Refresh context'}>
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/15" onClick={newConversation} title={locale === 'fr' ? 'Nouvelle conversation' : 'New conversation'}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/15" onClick={() => setOpen(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.length === 0 && (
                  <div className="space-y-4 py-3">
                    <div className="flex flex-col items-center text-center gap-3">
                      <AICoachAvatar size="lg" pulsing />
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {locale === 'fr' ? 'Bonjour 👋 Je suis votre Coach Financier' : 'Hi 👋 I\'m your Financial Coach'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                          {locale === 'fr'
                            ? 'J\'ai accès à vos comptes, budgets, épargne et dettes pour des conseils chiffrés et actionnables.'
                            : 'I have access to your accounts, budgets, savings and debts for actionable advice.'}
                        </p>
                      </div>
                    </div>
                    {context?.summary && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-card/60 backdrop-blur border border-border/40 rounded-xl p-2">
                          <span className="text-muted-foreground">{locale === 'fr' ? 'Solde total' : 'Total balance'}</span>
                          <p className="font-bold text-foreground">{formatNumber(Math.round(context.summary.totalBalance), locale)}</p>
                        </div>
                        <div className="bg-card/60 backdrop-blur border border-border/40 rounded-xl p-2">
                          <span className="text-muted-foreground">{locale === 'fr' ? 'Taux épargne' : 'Savings rate'}</span>
                          <p className="font-bold text-foreground">{context.summary.savingsRate}%</p>
                        </div>
                        {typeof context.summary.healthScore === 'number' && (
                          <div className="bg-card/60 backdrop-blur border border-border/40 rounded-xl p-2 col-span-2">
                            <span className="text-muted-foreground">{locale === 'fr' ? 'Santé financière' : 'Financial health'}</span>
                            <p className="font-bold text-foreground">{context.summary.healthScore}/100</p>
                          </div>
                        )}
                      </div>
                    )}
                    <AIQuickPrompts prompts={quickPrompts} onPick={send} variant="cards" />
                  </div>
                )}
                {messages.map((m, i) => (
                  <AIMessageBubble
                    key={i}
                    role={m.role}
                    content={m.content}
                    timestamp={m.created_at}
                    streaming={isLoading && i === messages.length - 1 && m.role === 'assistant'}
                  />
                ))}
                {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                  <div className="flex gap-2 justify-start">
                    <AICoachAvatar size="sm" pulsing />
                    <div className="bg-card/70 backdrop-blur border border-border/40 rounded-2xl rounded-bl-sm px-3 py-2.5 flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{locale === 'fr' ? 'Coach réfléchit…' : 'Coach thinking…'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Jump to bottom */}
              <AnimatePresence>
                {showJump && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                    onClick={() => { setShowJump(false); scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }}
                    className="absolute bottom-32 right-4 z-20 bg-foreground text-background rounded-full shadow-lg px-3 py-1.5 text-xs flex items-center gap-1"
                  >
                    <ChevronDown className="w-3 h-3" /> {locale === 'fr' ? 'Bas' : 'Bottom'}
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Follow-up suggestions */}
              {followUps.length > 0 && !isLoading && (
                <div className="px-3 pb-1.5 pt-1 border-t border-border/30">
                  <AIQuickPrompts prompts={followUps} onPick={send} />
                </div>
              )}

              {/* Composer */}
              <form onSubmit={e => { e.preventDefault(); send(); }} className="p-2.5 border-t border-border/40 bg-background/60 backdrop-blur flex gap-2 items-end">
                <Textarea
                  ref={inputRef as any}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={locale === 'fr' ? 'Pose ta question… (Entrée pour envoyer)' : 'Ask a question… (Enter to send)'}
                  className="flex-1 rounded-xl text-sm min-h-[40px] max-h-32 resize-none py-2"
                  rows={1}
                  disabled={isLoading}
                />
                <Button type="submit" size="icon" className="h-10 w-10 rounded-xl text-primary-foreground shrink-0" style={{ background: 'var(--gradient-primary)' }} disabled={isLoading || !input.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AIChatWidget;
