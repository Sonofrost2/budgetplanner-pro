import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';

interface Props {
  assets: { asset_type: string; current_value: number; acquisition_cost: number; acquisition_date: string | null }[];
  valuations: { asset_id: string; valued_at: string; value: number }[];
  totalSavings: number;
  totalDebt: number;
  fmt: (n: number) => string;
  isFr: boolean;
}

/**
 * Projects net worth 5 years into the future using historical CAGR per asset type.
 * Falls back to conservative defaults when insufficient data exists.
 */
export const WealthProjectionChart = ({ assets, valuations, totalSavings, totalDebt, fmt, isFr }: Props) => {
  const projectionData = useMemo(() => {
    // Calculate annualised growth rates per asset type from valuations
    const typeGrowth: Record<string, number> = {};
    const byAsset: Record<string, { dates: string[]; values: number[]; type: string }> = {};

    assets.forEach(a => {
      const vals = valuations.filter(v => v.asset_id === (a as any).id);
      if (vals.length >= 2) {
        const sorted = [...vals].sort((x, y) => x.valued_at.localeCompare(y.valued_at));
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const years = Math.max(0.25, (new Date(last.valued_at).getTime() - new Date(first.valued_at).getTime()) / (365.25 * 86400000));
        const cagr = Math.pow(last.value / Math.max(1, first.value), 1 / years) - 1;
        byAsset[(a as any).id] = { dates: sorted.map(s => s.valued_at), values: sorted.map(s => s.value), type: a.asset_type };
        typeGrowth[a.asset_type] = typeGrowth[a.asset_type] !== undefined
          ? (typeGrowth[a.asset_type] + cagr) / 2
          : cagr;
      }
    });

    // Defaults per type if no data
    const defaults: Record<string, number> = {
      real_estate: 0.05,
      vehicle: -0.10,
      financial: 0.07,
      savings: 0.03,
      jewelry: 0.03,
      other: 0.02,
    };

    const getRate = (type: string) => {
      const r = typeGrowth[type] ?? defaults[type] ?? 0.03;
      return Math.max(-0.20, Math.min(0.30, r)); // clamp
    };

    const now = new Date();
    const currentYear = now.getFullYear();
    const totalAssets = assets.reduce((s, a) => s + Number(a.current_value), 0);
    const currentNet = totalAssets + totalSavings - totalDebt;

    const data: { year: string; optimistic: number; base: number; pessimistic: number }[] = [];

    for (let y = 0; y <= 5; y++) {
      if (y === 0) {
        data.push({ year: String(currentYear), optimistic: currentNet, base: currentNet, pessimistic: currentNet });
        continue;
      }

      let baseAssets = 0;
      assets.forEach(a => {
        const rate = getRate(a.asset_type);
        baseAssets += Number(a.current_value) * Math.pow(1 + rate, y);
      });

      const baseSavings = totalSavings * Math.pow(1.03, y);
      const baseDebt = totalDebt * Math.pow(0.85, y); // assume 15%/yr payoff

      const base = baseAssets + baseSavings - baseDebt;
      const optimistic = base * (1 + 0.02 * y); // +2%/yr bonus
      const pessimistic = base * (1 - 0.02 * y); // -2%/yr drag

      data.push({
        year: String(currentYear + y),
        optimistic: Math.round(optimistic),
        base: Math.round(base),
        pessimistic: Math.round(pessimistic),
      });
    }

    return data;
  }, [assets, valuations, totalSavings, totalDebt]);

  const growthPct = projectionData.length >= 2
    ? (((projectionData[projectionData.length - 1].base - projectionData[0].base) / Math.max(1, projectionData[0].base)) * 100).toFixed(1)
    : '0';

  return (
    <Card className="rounded-2xl border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          {isFr ? 'Projection du patrimoine sur 5 ans' : '5-Year Wealth Projection'}
          <span className="text-[10px] font-semibold text-secondary ml-auto">
            {Number(growthPct) >= 0 ? '+' : ''}{growthPct}%
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {projectionData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={projectionData}>
              <defs>
                <linearGradient id="projBaseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="projOptGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${(v / 1e3).toFixed(0)}K`} className="text-muted-foreground" />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="optimistic" name={isFr ? 'Optimiste' : 'Optimistic'} stroke="hsl(var(--secondary))" fill="url(#projOptGrad)" strokeWidth={1.5} strokeDasharray="4 4" />
              <Area type="monotone" dataKey="base" name={isFr ? 'Base' : 'Base'} stroke="hsl(var(--primary))" fill="url(#projBaseGrad)" strokeWidth={2.5} />
              <Area type="monotone" dataKey="pessimistic" name={isFr ? 'Pessimiste' : 'Pessimistic'} stroke="hsl(var(--destructive))" fill="none" strokeWidth={1.5} strokeDasharray="4 4" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            {isFr ? 'Ajoutez des actifs pour voir les projections' : 'Add assets to see projections'}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
