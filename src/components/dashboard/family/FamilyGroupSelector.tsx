import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Trash2, Users, Crown } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import { useLanguage } from '@/i18n/LanguageContext';

interface Props {
  groups: Tables<'family_groups'>[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  currentUserId: string;
  onDeleteRequest: (id: string) => void;
}

export const FamilyGroupSelector = ({ groups, selectedId, onSelect, currentUserId, onDeleteRequest }: Props) => {
  const { locale } = useLanguage();
  const fr = locale === 'fr';
  const selected = groups.find((g) => g.id === selectedId);
  const isOwner = selected?.owner_id === currentUserId;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={selectedId || ''} onValueChange={onSelect}>
        <SelectTrigger className="w-[280px] h-10">
          <Users className="w-4 h-4 mr-2 text-primary" />
          <SelectValue placeholder={fr ? 'Sélectionner un groupe' : 'Select a group'} />
        </SelectTrigger>
        <SelectContent>
          {groups.map((g) => (
            <SelectItem key={g.id} value={g.id}>
              <div className="flex items-center gap-2">
                <span>{g.name}</span>
                {g.owner_id === currentUserId && <Crown className="w-3 h-3 text-amber-500" />}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selected && isOwner && (
        <Button size="sm" variant="outline" className="text-destructive" onClick={() => onDeleteRequest(selected.id)}>
          <Trash2 className="w-3.5 h-3.5 mr-1" />{fr ? 'Supprimer' : 'Delete'}
        </Button>
      )}
    </div>
  );
};
