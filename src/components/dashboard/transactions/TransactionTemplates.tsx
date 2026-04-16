import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Template {
  id: string; name: string; description: string; amount: number | null; type: string;
  category_id: string | null; account_id: string | null; use_count: number;
}

interface Props {
  onPick: (tpl: Template) => void;
  locale?: string;
}

export const TransactionTemplates = ({ onPick, locale = 'fr' }: Props) => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const fr = locale === 'fr';

  useEffect(() => {
    if (!user) return;
    supabase.from('transaction_templates').select('*').eq('user_id', user.id)
      .order('use_count', { ascending: false }).limit(5)
      .then(({ data }) => setTemplates((data || []) as Template[]));
  }, [user]);

  if (templates.length === 0) return null;

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      <Zap className="w-3.5 h-3.5 text-primary shrink-0" />
      <span className="text-xs text-muted-foreground shrink-0">{fr ? 'Rapide :' : 'Quick:'}</span>
      {templates.map(t => (
        <Button key={t.id} size="sm" variant="outline" onClick={() => {
          onPick(t);
          supabase.from('transaction_templates').update({ use_count: t.use_count + 1 } as never).eq('id', t.id);
        }} className="h-7 text-xs rounded-full shrink-0">
          {t.name}
        </Button>
      ))}
    </div>
  );
};
