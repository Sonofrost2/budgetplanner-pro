import { useState, KeyboardEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { X, Hash } from 'lucide-react';

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  locale?: string;
}

export const TagsInput = ({ value, onChange, locale = 'fr' }: Props) => {
  const [input, setInput] = useState('');
  const fr = locale === 'fr';

  const addTag = () => {
    const t = input.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    if (t && !value.includes(t) && value.length < 8) onChange([...value, t]);
    setInput('');
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
    else if (e.key === 'Backspace' && !input && value.length) onChange(value.slice(0, -1));
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 flex-wrap p-2 rounded-xl border border-border bg-card/50 min-h-[42px]">
        {value.map(tag => (
          <Badge key={tag} variant="secondary" className="gap-1 rounded-full">
            <Hash className="w-2.5 h-2.5" />
            {tag}
            <button onClick={() => onChange(value.filter(t => t !== tag))} className="hover:text-destructive">
              <X className="w-2.5 h-2.5" />
            </button>
          </Badge>
        ))}
        <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey} onBlur={addTag}
          placeholder={value.length === 0 ? (fr ? 'Tags (Entrée pour valider)' : 'Tags (Enter to add)') : ''}
          className="border-0 flex-1 min-w-[120px] h-7 px-1 focus-visible:ring-0" />
      </div>
    </div>
  );
};
