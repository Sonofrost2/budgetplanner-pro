import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Lightbulb, TrendingDown, Merge, RefreshCcw, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Category } from '@/hooks/useDashboardData';
import type { CategoryStats } from '@/lib/categoryAnalytics';

interface Suggestion {
  type: 'duplicate' | 'unused' | 'reparent' | 'split';
  title: string;
  description: string;
  category_ids?: string[];
  target_id?: string;
  parent_id?: string;
}

interface Props {
  categories: Category[];
  stats: Record<string, CategoryStats>;
  isFr: boolean;
  onRefresh: () => void;
}

export const CategoryCoachTab = ({ categories, stats, isFr, onRefresh }: Props) => {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const ask = async () => {
    setLoading(true);
    try {
      const payload = categories.map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        parent_id: c.parent_category_id,
        tx_count: stats[c.id]?.transaction_count ?? 0,
        total: stats[c.id]?.total_amount ?? 0,
      }));
      const { data, error } = await supabase.functions.invoke('ai-categories-suggest', { body: { categories: payload, locale: isFr ? 'fr' : 'en' } });
      if (error) throw error;
      setSuggestions(data?.suggestions ?? []);
    } catch (e: any) {
      toast.error(e.message ?? 'AI error');
    } finally {
      setLoading(false);
    }
  };

  const unusedLocal = categories.filter(c => (stats[c.id]?.transaction_count ?? 0) === 0);

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-primary/20 bg-primary/5">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-base">{isFr ? 'Coach Catégories' : 'Categories Coach'}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {isFr ? 'Détecte doublons, catégories inutilisées et suggère une meilleure hiérarchie.' : 'Detects duplicates, unused categories and suggests better hierarchy.'}
                </p>
              </div>
            </div>
            <Button onClick={ask} disabled={loading} className="rounded-xl text-primary-foreground" style={{ background: 'var(--gradient-primary)' }}>
              {loading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-1.5" />}
              {isFr ? 'Analyser' : 'Analyze'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick local insight: unused */}
      {unusedLocal.length > 0 && (
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="w-4 h-4 text-amber-500" />
              <h4 className="font-medium text-sm">{isFr ? `${unusedLocal.length} catégories sans transaction` : `${unusedLocal.length} categories with no transaction`}</h4>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {unusedLocal.slice(0, 12).map(c => (
                <span key={c.id} className="text-xs px-2 py-1 rounded-lg bg-muted">{c.icon} {c.name}</span>
              ))}
              {unusedLocal.length > 12 && <span className="text-xs text-muted-foreground self-center">+{unusedLocal.length - 12}</span>}
            </div>
          </CardContent>
        </Card>
      )}

      {suggestions.length === 0 && !loading && (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="p-8 text-center">
            <Lightbulb className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {isFr ? "Lance l'analyse pour recevoir des suggestions personnalisées." : 'Run analysis to receive personalized suggestions.'}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {suggestions.map((s, i) => (
          <Card key={i} className="rounded-2xl">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                {s.type === 'duplicate' && <Merge className="w-4 h-4 text-primary" />}
                {s.type === 'unused' && <TrendingDown className="w-4 h-4 text-amber-500" />}
                {s.type === 'reparent' && <Lightbulb className="w-4 h-4 text-primary" />}
                {s.type === 'split' && <Sparkles className="w-4 h-4 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{s.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
