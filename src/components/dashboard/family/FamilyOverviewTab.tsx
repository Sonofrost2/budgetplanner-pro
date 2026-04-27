import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Crown, Wallet } from 'lucide-react';
import { MemberAvatar } from './MemberAvatar';
import type { FamilyDashboard } from '@/hooks/useFamilyData';
import { useLanguage } from '@/i18n/LanguageContext';
import { formatNumber } from '@/lib/currency';

interface Props {
  dashboard: FamilyDashboard | null;
  currency: string;
}

export const FamilyOverviewTab = ({ dashboard, currency }: Props) => {
  const { locale } = useLanguage();
  const fmt = (n: number, c: string) => `${formatNumber(Math.round(n), locale)} ${c}`;
  if (!dashboard) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-16 text-center text-muted-foreground">
          Sélectionnez un groupe pour voir son tableau de bord.
        </CardContent>
      </Card>
    );
  }

  const topContributor = [...dashboard.members].sort((a, b) => b.expense - a.expense)[0];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Totaux */}
      <Card className="lg:col-span-1 border-none shadow-[var(--shadow-card)] bg-gradient-to-br from-primary/5 to-accent/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Wallet className="w-4 h-4 text-primary" />Bilan période</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-2 text-sm"><TrendingUp className="w-4 h-4 text-emerald-500" />Revenus</div>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(dashboard.total_income, currency)}</span>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
            <div className="flex items-center gap-2 text-sm"><TrendingDown className="w-4 h-4 text-rose-500" />Dépenses</div>
            <span className="font-semibold text-rose-600 dark:text-rose-400 tabular-nums">{fmt(dashboard.total_expense, currency)}</span>
          </div>
          <div className={`flex items-center justify-between p-3 rounded-lg border ${dashboard.net >= 0 ? 'bg-primary/10 border-primary/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
            <span className="text-sm font-medium">Solde net</span>
            <span className={`font-bold text-lg tabular-nums ${dashboard.net >= 0 ? 'text-primary' : 'text-amber-600'}`}>
              {dashboard.net >= 0 ? '+' : ''}{fmt(dashboard.net, currency)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Top contributeur */}
      <Card className="lg:col-span-2 border-none shadow-[var(--shadow-card)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Crown className="w-4 h-4 text-amber-500" />Contributions par membre</CardTitle>
        </CardHeader>
        <CardContent>
          {dashboard.members.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Aucune activité sur cette période.</p>
          ) : (
            <div className="space-y-3">
              {dashboard.members.map((m) => {
                const pct = dashboard.total_expense > 0 ? (m.expense / dashboard.total_expense) * 100 : 0;
                return (
                  <div key={m.user_id} className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <MemberAvatar userId={m.user_id} displayName={m.display_name} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">{m.display_name}</span>
                          <span className="text-sm tabular-nums font-semibold text-rose-600 dark:text-rose-400">
                            {fmt(m.expense, currency)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{m.tx_count} transaction{m.tx_count > 1 ? 's' : ''}</span>
                          <span>{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          )}
          {topContributor && topContributor.expense > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <span><strong>{topContributor.display_name}</strong> est le top contributeur du foyer cette période.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top catégories */}
      <Card className="lg:col-span-3 border-none shadow-[var(--shadow-card)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Top 5 catégories de dépenses</CardTitle>
        </CardHeader>
        <CardContent>
          {dashboard.top_categories.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Aucune catégorie cette période.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {dashboard.top_categories.map((c) => (
                <div key={c.category_id || 'none'} className="p-3 rounded-lg border border-border/60 bg-card/50 hover:bg-card transition-colors">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-2xl">{c.icon || '📁'}</span>
                    <Badge variant="secondary" className="text-[10px]">{c.name || 'Sans cat.'}</Badge>
                  </div>
                  <p className="text-sm font-bold tabular-nums">{fmt(c.total, currency)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
