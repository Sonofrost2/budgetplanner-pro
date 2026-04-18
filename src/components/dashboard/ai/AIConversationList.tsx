import { Trash2, MessageSquare, Plus, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import type { AIConversation } from '@/hooks/useAIConversations';

interface Props {
  conversations: AIConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  locale: 'fr' | 'en';
}

const formatDate = (iso: string, locale: string) => {
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { day: '2-digit', month: 'short' });
  } catch { return ''; }
};

export const AIConversationList = ({ conversations, activeId, onSelect, onNew, onArchive, onDelete, locale }: Props) => {
  return (
    <div className="flex flex-col h-full bg-muted/20 border-r border-border/40 w-56 shrink-0">
      <div className="p-2 border-b border-border/40">
        <Button onClick={onNew} variant="default" size="sm" className="w-full gap-1.5 h-8 text-xs" style={{ background: 'var(--gradient-primary)' }}>
          <Plus className="w-3.5 h-3.5" /> {locale === 'fr' ? 'Nouvelle' : 'New'}
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-1.5 space-y-0.5">
          <AnimatePresence>
            {conversations.length === 0 && (
              <p className="text-[11px] text-muted-foreground text-center py-4 px-2">
                {locale === 'fr' ? 'Aucune conversation' : 'No conversation yet'}
              </p>
            )}
            {conversations.map((c) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${
                  activeId === c.id ? 'bg-primary/15 text-foreground' : 'hover:bg-muted/60 text-muted-foreground'
                }`}
                onClick={() => onSelect(c.id)}
              >
                <MessageSquare className="w-3 h-3 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{c.title}</p>
                  <p className="text-[10px] opacity-60">{formatDate(c.updated_at, locale)}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onArchive(c.id); }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-foreground"
                  title={locale === 'fr' ? 'Archiver' : 'Archive'}
                >
                  <Archive className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); if (confirm(locale === 'fr' ? 'Supprimer ?' : 'Delete?')) onDelete(c.id); }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive"
                  title={locale === 'fr' ? 'Supprimer' : 'Delete'}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  );
};
