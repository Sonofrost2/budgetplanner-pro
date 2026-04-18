import { motion } from 'framer-motion';

interface Props {
  prompts: string[];
  onPick: (prompt: string) => void;
  variant?: 'chips' | 'cards';
}

export const AIQuickPrompts = ({ prompts, onPick, variant = 'chips' }: Props) => {
  if (variant === 'cards') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {prompts.map((p, i) => (
          <motion.button
            key={p}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => onPick(p)}
            className="text-left text-xs px-3 py-2.5 rounded-xl border border-border/40 bg-card/40 backdrop-blur hover:bg-card/80 hover:border-primary/40 hover:shadow-sm text-foreground transition-all"
          >
            {p}
          </motion.button>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {prompts.map((p) => (
        <button
          key={p}
          onClick={() => onPick(p)}
          className="text-[11px] px-2.5 py-1 rounded-full border border-border/40 bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
        >
          {p}
        </button>
      ))}
    </div>
  );
};
