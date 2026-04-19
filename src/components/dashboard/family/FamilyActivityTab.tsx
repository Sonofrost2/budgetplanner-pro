import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MemberAvatar } from './MemberAvatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { FamilyTransaction } from '@/hooks/useFamilyData';
import type { MemberWithProfile } from '@/hooks/useFamilyData';

interface Props {
  activity: FamilyTransaction[];
  members: MemberWithProfile[];
  currency: string;
}

export const FamilyActivityTab = ({ activity, members, currency }: Props) => {
  const [filterUserId, setFilterUserId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!filterUserId) return activity;
    return activity.filter((t) => t.user_id === filterUserId);
  }, [activity, filterUserId]);

  return (
    <Card className="border-none shadow-[var(--shadow-card)]">
      <CardHeader className="pb-3 space-y-3">
        <CardTitle className="text-sm">Activité récente ({filtered.length})</CardTitle>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant={filterUserId === null ? 'default' : 'outline'} onClick={() => setFilterUserId(null)} className="h-7 text-xs">Tous</Button>
          {members.map((m) => (
            <Button
              key={m.user_id}
              size="sm"
              variant={filterUserId === m.user_id ? 'default' : 'outline'}
              onClick={() => setFilterUserId(m.user_id)}
              className="h-7 text-xs gap-1.5"
            >
              <MemberAvatar userId={m.user_id} displayName={m.display_name} size="sm" className="h-4 w-4 text-[8px] ring-0" />
              {(m.display_name || 'Membre').split(' ')[0]}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center">Aucune activité.</p>
        ) : (
          <ScrollArea className="h-[480px]">
            <div className="divide-y divide-border">
              {filtered.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/5 transition-colors">
                  <MemberAvatar userId={tx.user_id} displayName={tx.display_name} size="sm" />
                  <span className="text-lg flex-shrink-0">{tx.category_icon || '📁'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{tx.description}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {tx.display_name} · {tx.category_name || 'Sans cat.'} · {new Date(tx.date).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums whitespace-nowrap ${tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {tx.type === 'income' ? '+' : '−'}{Math.round(tx.amount).toLocaleString('fr-FR')} {currency}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
