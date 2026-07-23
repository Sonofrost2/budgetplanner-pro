import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Lightbulb, TrendingDown, Merge, RefreshCcw, Loader2, AlertTriangle, Copy, ShieldOff } from 'lucide-react';
import { invokeAuthedEdgeFunction } from '@/lib/aiEdge';
import { toast } from 'sonner';
import type { Category } from '@/hooks/useDashboardData';
import type { CategoryStats } from '@/lib/categoryAnalytics';
import { findDuplicateCategories, isCatchAllCategory, normalizeSparkline } from '@/lib/categoryAnalytics';

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
  budgetCategoryIds?: Set<string>;
}

export const CategoryCoachTab = ({ categories, stats, isFr, onRefresh, budgetCategoryIds }: Props) => {
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
      const data = await invokeAuthedEdgeFunction<any>('ai-categories-suggest', { locale: isFr ? 'fr' : 'en', body: { categories: payload, locale: isFr ? 'fr' : 'en' } });
      setSuggestions(data?.suggestions ?? []);
    } catch (e: any) {
      toast.error(e.message ?? 'AI error');
    } finally {
      setLoading(false);
    }
  };

  const unusedLocal = categories.filter(c => (stats[c.id]?.transaction_count ?? 0) === 0);
  const duplicatesLocal = findDuplicateCategories(categories);
  const catchAllLocal = categories.filter(c => isCatchAllCategory(c.name));
  const orphanLocal = categories.filter(c => {
    if (c.type !== 'expense') return false;
    if (budgetCategoryIds?.has(c.id)) return false;
    const s = stats[c.id];
    const series = normalizeSparkline(s?.monthly_series ?? []);
    return (series[series.length - 1] ?? 0) > 0;
  });

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

      {/* Quick local insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {duplicatesLocal.length > 0 && (
          <LocalCard
            icon={<Copy className="w-4 h-4 text-primary" />}
            title={isFr ? `${duplicatesLocal.length} groupe(s) de doublons` : `${duplicatesLocal.length} duplicate group(s)`}
            hint={isFr ? 'Sélectionne-les puis clique "Fusionner".' : 'Select them then click "Merge".'}
          >
            <div className="flex flex-wrap gap-1.5">
              {duplicatesLocal.slice(0, 6).map((d, i) => (
                <span key={i} className="text-[11px] px-2 py-1 rounded-lg bg-muted">
                  {d.name} <span className="text-muted-foreground">·{d.ids.length}</span>
                </span>
              ))}
            </div>
          </LocalCard>
        )}
        {catchAllLocal.length > 0 && (
          <LocalCard
            icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
            title={isFr ? `${catchAllLocal.length} catégorie(s) fourre-tout` : `${catchAllLocal.length} catch-all categor(y|ies)`}
            hint={isFr ? 'Renomme-les et divise en sous-catégories plus précises.' : 'Rename and split into more precise sub-categories.'}
          >
            <div className="flex flex-wrap gap-1.5">
              {catchAllLocal.slice(0, 8).map(c => (
                <span key={c.id} className="text-[11px] px-2 py-1 rounded-lg bg-muted">{c.icon} {c.name}</span>
              ))}
            </div>
          </LocalCard>
        )}
        {orphanLocal.length > 0 && (
          <LocalCard
            icon={<ShieldOff className="w-4 h-4 text-amber-500" />}
            title={isFr ? `${orphanLocal.length} dépense(s) sans budget` : `${orphanLocal.length} expense(s) without budget`}
            hint={isFr ? 'Crée un budget lié pour ces catégories actives.' : 'Create a linked budget for these active categories.'}
          >
            <div className="flex flex-wrap gap-1.5">
              {orphanLocal.slice(0, 8).map(c => (
                <span key={c.id} className="text-[11px] px-2 py-1 rounded-lg bg-muted">{c.icon} {c.name}</span>
              ))}
            </div>
          </LocalCard>
        )}
        {unusedLocal.length > 0 && (
          <LocalCard
            icon={<TrendingDown className="w-4 h-4 text-muted-foreground" />}
            title={isFr ? `${unusedLocal.length} catégorie(s) sans transaction` : `${unusedLocal.length} unused categor(y|ies)`}
            hint={isFr ? 'Archive celles que tu n\'utilises plus.' : 'Archive the ones you no longer use.'}
          >
            <div className="flex flex-wrap gap-1.5">
              {unusedLocal.slice(0, 10).map(c => (
                <span key={c.id} className="text-[11px] px-2 py-1 rounded-lg bg-muted">{c.icon} {c.name}</span>
              ))}
              {unusedLocal.length > 10 && <span className="text-[11px] text-muted-foreground self-center">+{unusedLocal.length - 10}</span>}
            </div>
          </LocalCard>
        )}
      </div>

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

const LocalCard = ({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint: string; children: React.ReactNode }) => (
  <Card className="rounded-2xl">
    <CardContent className="p-4 space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <h4 className="font-semibold text-sm">{title}</h4>
      </div>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
      {children}
    </CardContent>
  </Card>
);
