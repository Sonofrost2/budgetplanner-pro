import { Button } from '@/components/ui/button';
import { SkipForward } from 'lucide-react';
import { skipRecurringOccurrence } from '@/lib/recurringSkip';
import { toast } from 'sonner';

interface Props {
  recurringId: string;
  nextDate: string;
  skippedDates: string[];
  onSkipped: () => void;
  locale?: string;
}

export const SkipRecurringButton = ({ recurringId, nextDate, skippedDates, onSkipped, locale = 'fr' }: Props) => {
  const fr = locale === 'fr';
  const handleSkip = async () => {
    const { error } = await skipRecurringOccurrence(recurringId, skippedDates, nextDate);
    if (error) toast.error(error.message);
    else { toast.success(fr ? 'Occurrence sautée' : 'Occurrence skipped'); onSkipped(); }
  };
  return (
    <Button size="sm" variant="ghost" onClick={handleSkip} className="h-7 text-xs gap-1">
      <SkipForward className="w-3 h-3" />
      {fr ? 'Sauter' : 'Skip'}
    </Button>
  );
};
