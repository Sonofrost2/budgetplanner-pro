import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, X, Sparkles, ArrowRight, Tag, Wallet, ListPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useActivationChecklist, type ActivationTaskId } from '@/hooks/useActivationChecklist';
import { useLanguage } from '@/i18n/LanguageContext';

type TaskCopy = { title: string; desc: string; cta: string; icon: typeof Tag; route: string };

const COPY: Record<'fr' | 'en', Record<ActivationTaskId, TaskCopy>> = {
  fr: {
    categories: {
      title: 'Explore tes catégories',
      desc: 'Personnalise tes catégories pour mieux classer tes dépenses.',
      cta: 'Voir mes catégories',
      icon: Tag,
      route: '/dashboard/categories',
    },
    account: {
      title: 'Crée ton premier compte',
      desc: 'Wave, Orange Money, Banque, Espèces… tout commence ici.',
      cta: 'Ajouter un compte',
      icon: Wallet,
      route: '/dashboard/accounts',
    },
    transactions: {
      title: 'Saisis 3 transactions',
      desc: 'Le coach a besoin de vraies données pour t\'aider.',
      cta: 'Ajouter une transaction',
      icon: ListPlus,
      route: '/dashboard/transactions',
    },
  },
  en: {
    categories: {
      title: 'Explore your categories',
      desc: 'Customize them so your spending is sorted your way.',
      cta: 'View categories',
      icon: Tag,
      route: '/dashboard/categories',
    },
    account: {
      title: 'Create your first account',
      desc: 'Mobile Money, Bank, Cash… everything starts here.',
      cta: 'Add an account',
      icon: Wallet,
      route: '/dashboard/accounts',
    },
    transactions: {
      title: 'Log 3 transactions',
      desc: 'Your coach needs real data to start helping you.',
      cta: 'Add a transaction',
      icon: ListPlus,
      route: '/dashboard/transactions',
    },
  },
};

export const ActivationChecklistCard = () => {
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const { visible, tasks, progress, doneCount, totalCount, dismiss } = useActivationChecklist();

  if (!visible) return null;
  const isFr = locale === 'fr';
  const copy = COPY[isFr ? 'fr' : 'en'];
  const pct = Math.round(progress * 100);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        className="overflow-hidden"
      >
        <div className="glass relative rounded-3xl p-5 sm:p-6 border border-primary/20 shadow-[var(--shadow-elevated)]">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center text-primary-foreground"
                style={{ background: 'var(--gradient-primary)' }}
              >
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold font-display leading-tight">
                  {isFr ? 'Lance ton tableau de bord en 3 étapes' : 'Launch your dashboard in 3 steps'}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  {isFr
                    ? `${doneCount}/${totalCount} étapes — moins de 2 minutes pour activer le Coach`
                    : `${doneCount}/${totalCount} steps — under 2 minutes to activate your Coach`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void dismiss()}
              aria-label={isFr ? 'Masquer la checklist' : 'Dismiss checklist'}
              className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="mb-5">
            <Progress value={pct} className="h-2" />
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mt-1.5">
              {pct}% {isFr ? 'complété' : 'complete'}
            </p>
          </div>

          {/* Task list */}
          <ul className="space-y-2">
            {tasks.map((task) => {
              const c = copy[task.id];
              const Icon = c.icon;
              return (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => navigate(c.route)}
                    className={`group w-full text-left flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                      task.done
                        ? 'bg-secondary/5 border-secondary/30'
                        : 'bg-background/40 border-border/40 hover:border-primary/40 hover:bg-primary/5'
                    }`}
                  >
                    <div className="shrink-0">
                      {task.done ? (
                        <CheckCircle2 className="w-5 h-5 text-secondary" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className={`w-3.5 h-3.5 shrink-0 ${task.done ? 'text-secondary' : 'text-muted-foreground'}`} />
                        <p className={`text-sm font-semibold truncate ${task.done ? 'line-through text-muted-foreground' : ''}`}>
                          {c.title}
                          {task.target > 1 && (
                            <span className="ml-1.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                              ({task.current}/{task.target})
                            </span>
                          )}
                        </p>
                      </div>
                      <p className="text-[11px] sm:text-xs text-muted-foreground truncate mt-0.5">{c.desc}</p>
                    </div>
                    {!task.done && (
                      <Button size="sm" variant="ghost" className="shrink-0 h-8 px-2.5 text-xs font-semibold" tabIndex={-1}>
                        {c.cta}
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ActivationChecklistCard;