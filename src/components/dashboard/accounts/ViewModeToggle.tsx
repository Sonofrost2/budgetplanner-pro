import { Button } from '@/components/ui/button';
import { LayoutGrid, List, Layers } from 'lucide-react';

export type AccountsViewMode = 'cards' | 'list' | 'treasury';

interface Props {
  value: AccountsViewMode;
  onChange: (mode: AccountsViewMode) => void;
  isFr: boolean;
}

export const ViewModeToggle = ({ value, onChange, isFr }: Props) => {
  const options: { value: AccountsViewMode; icon: any; label: string }[] = [
    { value: 'cards', icon: LayoutGrid, label: isFr ? 'Cartes' : 'Cards' },
    { value: 'list', icon: List, label: isFr ? 'Liste' : 'List' },
    { value: 'treasury', icon: Layers, label: isFr ? 'Trésorerie' : 'Treasury' },
  ];

  return (
    <div className="inline-flex items-center bg-muted/50 rounded-xl p-1 gap-0.5">
      {options.map(opt => {
        const Icon = opt.icon;
        const active = value === opt.value;
        return (
          <Button
            key={opt.value}
            size="sm"
            variant={active ? 'default' : 'ghost'}
            className={`h-7 rounded-lg gap-1.5 text-xs ${active ? 'shadow-sm' : ''}`}
            onClick={() => onChange(opt.value)}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{opt.label}</span>
          </Button>
        );
      })}
    </div>
  );
};
