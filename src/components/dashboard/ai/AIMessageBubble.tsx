import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AICoachAvatar } from './AICoachAvatar';
import { parseAIActions, type AIAction } from '@/lib/aiActionParser';
import { ArrowRight, Plus, Target } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { formatNumber } from '@/lib/currency';

interface Props {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  streaming?: boolean;
}

const formatTime = (iso?: string) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

const ActionButton = ({ action }: { action: AIAction }) => {
  const navigate = useNavigate();
  const { locale } = useLanguage();
  const fmt = (n: number) => formatNumber(n, locale);
  switch (action.type) {
    case 'create_budget':
      return (
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
          onClick={() => navigate(`/dashboard/budgets?create=1&category=${encodeURIComponent(action.category)}&amount=${action.amount}`)}>
          <Plus className="w-3 h-3" /> Cadre {action.category} ({fmt(action.amount)})
        </Button>
      );
    case 'create_savings_goal':
      return (
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
          onClick={() => navigate(`/dashboard/savings?create=1&name=${encodeURIComponent(action.name)}&target=${action.target}`)}>
          <Target className="w-3 h-3" /> Objectif {action.name} ({fmt(action.target)})
        </Button>
      );
    case 'view_module':
      return (
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
          onClick={() => navigate(`/dashboard/${action.module}`)}>
          <ArrowRight className="w-3 h-3" /> {action.module}
        </Button>
      );
  }
};

export const AIMessageBubble = ({ role, content, timestamp, streaming }: Props) => {
  const isUser = role === 'user';
  const { clean, actions } = isUser ? { clean: content, actions: [] as AIAction[] } : parseAIActions(content);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && <AICoachAvatar size="sm" pulsing={streaming} />}
      <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'} max-w-[85%]`}>
        <div className={`rounded-2xl px-3.5 py-2.5 text-sm ${
          isUser
            ? 'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-br-sm shadow-sm'
            : 'bg-card/70 backdrop-blur border border-border/40 text-foreground rounded-bl-sm shadow-sm'
        }`}>
          {isUser ? (
            <div className="whitespace-pre-wrap break-words">{content}</div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-1.5 [&>ul]:mb-1.5 [&>ol]:mb-1.5 [&>h1]:text-base [&>h2]:text-sm [&>h2]:mt-2 [&>h3]:text-sm [&>table]:text-xs [&_code]:text-xs">
              <ReactMarkdown>{clean || '…'}</ReactMarkdown>
              {streaming && (
                <span className="inline-flex gap-0.5 ml-1 align-middle">
                  <motion.span animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1, repeat: Infinity, delay: 0 }} className="w-1 h-1 rounded-full bg-primary inline-block" />
                  <motion.span animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1, repeat: Infinity, delay: 0.2 }} className="w-1 h-1 rounded-full bg-primary inline-block" />
                  <motion.span animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1, repeat: Infinity, delay: 0.4 }} className="w-1 h-1 rounded-full bg-primary inline-block" />
                </span>
              )}
            </div>
          )}
        </div>
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {actions.map((a, i) => <ActionButton key={i} action={a} />)}
          </div>
        )}
        {timestamp && (
          <span className="text-[10px] text-muted-foreground px-1">{formatTime(timestamp)}</span>
        )}
      </div>
    </motion.div>
  );
};
