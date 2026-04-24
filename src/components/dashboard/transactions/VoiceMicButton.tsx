import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface VoiceMicButtonProps {
  listening: boolean;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md';
  variant?: 'ghost' | 'solid';
  title?: string;
}

export const VoiceMicButton = ({
  listening, onClick, disabled, loading, size = 'sm', variant = 'ghost', title,
}: VoiceMicButtonProps) => {
  const dims = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  const icon = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <Button
      type="button"
      size="icon"
      variant={variant === 'solid' ? 'default' : 'ghost'}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        dims,
        'relative rounded-lg shrink-0',
        listening && 'bg-destructive/10 text-destructive hover:bg-destructive/20',
      )}
    >
      {loading ? (
        <Loader2 className={cn(icon, 'animate-spin')} />
      ) : listening ? (
        <>
          <MicOff className={icon} />
          <motion.span
            className="absolute inset-0 rounded-lg border-2 border-destructive/60"
            animate={{ opacity: [0.6, 0, 0.6], scale: [1, 1.15, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
          />
        </>
      ) : (
        <Mic className={icon} />
      )}
    </Button>
  );
};