import { Button } from '@/components/ui/button';
import { Pause, Play } from 'lucide-react';
import { pauseItem, resumeItem } from '@/lib/archive';
import { toast } from 'sonner';

interface Props {
  table: 'budgets' | 'savings_goals';
  id: string;
  pausedAt: string | null;
  onChanged: () => void;
  locale?: string;
}

export const PauseToggle = ({ table, id, pausedAt, onChanged, locale = 'fr' }: Props) => {
  const fr = locale === 'fr';
  const paused = !!pausedAt;
  const handle = async () => {
    const { error } = paused ? await resumeItem(table, id) : await pauseItem(table, id);
    if (error) toast.error(error.message);
    else { toast.success(paused ? (fr ? 'Repris' : 'Resumed') : (fr ? 'Mis en pause' : 'Paused')); onChanged(); }
  };
  return (
    <Button size="sm" variant="ghost" onClick={handle} className="h-7 text-xs gap-1">
      {paused ? <><Play className="w-3 h-3" />{fr ? 'Reprendre' : 'Resume'}</> : <><Pause className="w-3 h-3" />{fr ? 'Pause' : 'Pause'}</>}
    </Button>
  );
};
