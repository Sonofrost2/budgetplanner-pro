import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Activity, TrendingUp, BarChart3, Receipt } from 'lucide-react';
import { useAccountDrilldown } from '@/hooks/useAccountInsights';
import { abbreviateNumber } from '@/lib/utils';
import type { Account } from '@/hooks/useDashboardData';

interface Props {
  account: Account | null;
  onClose: () => void;
  fmt: (n: number) => string;
  isFr: boolean;
  locale: string;
}

export const AccountDrilldownDrawer = ({ account, onClose, fmt, isFr, locale }: Props) => {
  const { data, isLoading } = useAccountDrilldown(account?.id ?? null);

  return (
    <Sheet open={!!account} onOpenChange={open => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <span className="text-2xl">{account?.icon}</span>
            {account?.name}
          </SheetTitle>
          <SheetDescription>
            {isFr ? 'Statistiques détaillées sur 6 mois' : 'Detailed statistics over 6 months'}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-3 mt-6">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        ) : data ? (
          <div className="space-y-4 mt-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-3 rounded-xl border border-border/50">
                <div className="flex items-center gap-1.5 mb-1">
                  <Activity className="w-3.5 h-3.5 text-primary" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {isFr ? 'Vélocité' : 'Velocity'}
                  </p>
                </div>
                <p className="text-xl font-bold tabular-nums">{data.velocity}</p>
                <p className="text-[10px] text-muted-foreground">{isFr ? 'mvt/mois (6m)' : 'tx/month (6m)'}</p>
              </Card>
              <Card className="p-3 rounded-xl border border-border/50">
                <div className="flex items-center gap-1.5 mb-1">
                  <Receipt className="w-3.5 h-3.5 text-secondary" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {isFr ? 'Montant moyen' : 'Avg amount'}
                  </p>
                </div>
                <p className="text-xl font-bold tabular-nums">{fmt(data.avg_amount)}</p>
              </Card>
            </div>

            {/* Évolution mensuelle */}
            <Card className="p-4 rounded-2xl border border-border/50">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold">{isFr ? 'Évolution 12 mois' : '12-month evolution'}</h3>
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthly_evolution}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => abbreviateNumber(v, locale)} />
                    <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 12, border: 'none', background: 'hsl(var(--card))', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="income" fill={CHART_INCOME} radius={[4, 4, 0, 0]} name={isFr ? 'Entrées' : 'Income'} />
                    <Bar dataKey="expense" fill={CHART_ALERT} radius={[4, 4, 0, 0]} name={isFr ? 'Sorties' : 'Expenses'} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Top catégories */}
            <Card className="p-4 rounded-2xl border border-border/50">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-bold">{isFr ? 'Top dépenses (6m)' : 'Top expenses (6m)'}</h3>
              </div>
              {data.top_categories.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {isFr ? 'Aucune dépense' : 'No expenses'}
                </p>
              ) : (
                <div className="space-y-2">
                  {data.top_categories.map((cat, i) => {
                    const max = data.top_categories[0].total;
                    const pct = (cat.total / max) * 100;
                    return (
                      <div key={cat.category_id || i}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="flex items-center gap-1.5 truncate">
                            <span className="text-base">{cat.icon || '📁'}</span>
                            <span className="font-medium truncate">{cat.name || (isFr ? 'Sans catégorie' : 'Uncategorized')}</span>
                          </span>
                          <span className="font-bold tabular-nums shrink-0 ml-2">{fmt(cat.total)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: 'var(--gradient-primary)' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center mt-12">{isFr ? 'Aucune donnée' : 'No data'}</p>
        )}
      </SheetContent>
    </Sheet>
  );
};
