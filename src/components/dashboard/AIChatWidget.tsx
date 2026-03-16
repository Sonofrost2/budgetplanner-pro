import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, X, Send, Sparkles, Loader2, Trash2 } from 'lucide-react';
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

  // Fetch user context on first open
  const fetchContext = useCallback(async () => {
    if (!user || context) return;
    try {
      const [accRes, budRes, savRes, txRes, profRes] = await Promise.all([
        supabase.from('payment_accounts').select('name, type, real_balance').eq('user_id', user.id),
        supabase.from('budgets').select('name, amount, period, budget_type, category_id, categories(name)').eq('user_id', user.id),
        supabase.from('savings_goals').select('name, current_amount, target_amount, interest_rate, bank_name, deadline, monthly_contribution').eq('user_id', user.id),
        supabase.from('transactions').select('amount, type, category_id, date, categories(name)').eq('user_id', user.id).order('date', { ascending: false }).limit(50),
        supabase.from('profiles').select('display_name, currency, locale').eq('user_id', user.id).single(),
      ]);
      setContext({
        accounts: accRes.data || [],
        budgets: budRes.data || [],
        savings: savRes.data || [],
        recentTransactions: txRes.data || [],
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

  const suggestions = locale === 'fr'
    ? ['Comment optimiser mon épargne ?', 'Analyser mes dépenses', 'Quels investissements pour moi ?', 'Faire un bilan financier']
    : ['How to optimize my savings?', 'Analyze my expenses', 'What investments for me?', 'Financial overview'];

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
            className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[540px] max-h-[calc(100vh-6rem)] flex flex-col rounded-2xl border border-border/50 shadow-xl bg-background overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/50" style={{ background: 'var(--gradient-primary)' }}>
              <div className="flex items-center gap-2 text-primary-foreground">
                <Sparkles className="w-5 h-5" />
                <span className="font-bold text-sm">{locale === 'fr' ? 'Conseiller IA' : 'AI Advisor'}</span>
              </div>
              <div className="flex gap-1">
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
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground text-center">
                    {locale === 'fr' ? '👋 Bonjour ! Je suis votre conseiller financier IA. Posez-moi une question.' : '👋 Hi! I\'m your AI financial advisor. Ask me anything.'}
                  </p>
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
