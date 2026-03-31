import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PieChart as PieChartIcon, TrendingUp, Shield, BarChart3 } from 'lucide-react';
import { AnimatedNumber } from '@/components/ui/animated-number';

interface Asset {
  id: string;
  name: string;
  asset_type: string;
  current_value: number;
  acquisition_cost: number | null;
  category: string;
}

interface Valuation {
  asset_id: string;
  value: number;
  valued_at: string;
}

interface Props {
  assets: Asset[];
  valuations: Valuation[];
  totalSavings: number;
  totalDebt: number;
  fmt: (n: number) => string;
  isFr: boolean;
}

const WealthAnalysisTab = ({ assets, valuations, totalSavings, totalDebt, fmt, isFr }: Props) => {
  const totalAssets = assets.reduce((s, a) => s + Number(a.current_value), 0) + totalSavings;
  const netWorth = totalAssets - totalDebt;

  // Diversification by asset_type
  const diversification = useMemo(() => {
    const byType: Record<string, number> = {};
    assets.forEach(a => {
      byType[a.asset_type] = (byType[a.asset_type] || 0) + Number(a.current_value);
    });
    if (totalSavings > 0) byType['savings'] = totalSavings;
    const total = Object.values(byType).reduce((s, v) => s + v, 0);
    return Object.entries(byType)
      .map(([type, value]) => ({ type, value, pct: total > 0 ? (value / total) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [assets, totalSavings]);

  // Yield by type (gain/loss)
  const yieldByType = useMemo(() => {
    const byType: Record<string, { cost: number; current: number }> = {};
    assets.forEach(a => {
      if (!byType[a.asset_type]) byType[a.asset_type] = { cost: 0, current: 0 };
      byType[a.asset_type].current += Number(a.current_value);
      byType[a.asset_type].cost += Number(a.acquisition_cost || a.current_value);
    });
    return Object.entries(byType).map(([type, { cost, current }]) => ({
      type,
      cost,
      current,
      gain: current - cost,
      pct: cost > 0 ? ((current - cost) / cost) * 100 : 0,
    })).sort((a, b) => b.gain - a.gain);
  }, [assets]);

  // Health indicators
  const debtToAssetRatio = totalAssets > 0 ? (totalDebt / totalAssets) * 100 : 0;
  const diversificationScore = useMemo(() => {
    if (diversification.length <= 1) return 0;
    // Herfindahl index: lower = more diversified
    const hhi = diversification.reduce((s, d) => s + (d.pct / 100) ** 2, 0);
    // Normalize: 1/n is perfectly diversified
    const n = diversification.length;
    const minHhi = 1 / n;
    const score = Math.max(0, Math.min(100, ((1 - hhi) / (1 - minHhi)) * 100));
    return Math.round(score);
  }, [diversification]);

  const typeLabels: Record<string, { fr: string; en: string }> = {
    real_estate: { fr: 'Immobilier', en: 'Real Estate' },
    vehicle: { fr: 'Véhicules', en: 'Vehicles' },
    financial: { fr: 'Investissements', en: 'Investments' },
    business: { fr: 'Entreprise', en: 'Business' },
    collectible: { fr: 'Collections', en: 'Collectibles' },
    other: { fr: 'Autre', en: 'Other' },
    savings: { fr: 'Épargne', en: 'Savings' },
  };

  const getTypeLabel = (type: string) => typeLabels[type]?.[isFr ? 'fr' : 'en'] || type;

  return (
    <div className="space-y-4 mt-4">
      {/* Health indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-4 text-center">
            <Shield className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              {isFr ? 'Score diversification' : 'Diversification Score'}
            </p>
            <p className="text-2xl font-bold">{diversificationScore}<span className="text-sm text-muted-foreground">/100</span></p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {diversificationScore >= 60 ? (isFr ? 'Bien diversifié' : 'Well diversified') :
               diversificationScore >= 30 ? (isFr ? 'Moyennement diversifié' : 'Moderately diversified') :
               (isFr ? 'Peu diversifié' : 'Poorly diversified')}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-4 text-center">
            <BarChart3 className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              {isFr ? 'Ratio dettes/actifs' : 'Debt-to-Asset Ratio'}
            </p>
            <p className={`text-2xl font-bold ${debtToAssetRatio > 50 ? 'text-destructive' : debtToAssetRatio > 25 ? 'text-amber-500' : 'text-secondary'}`}>
              {debtToAssetRatio.toFixed(1)}%
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {debtToAssetRatio <= 25 ? (isFr ? 'Sain' : 'Healthy') :
               debtToAssetRatio <= 50 ? (isFr ? 'Modéré' : 'Moderate') :
               (isFr ? 'Élevé' : 'High')}
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50">
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              {isFr ? 'Plus-value totale' : 'Total Capital Gain'}
            </p>
            {(() => {
              const totalCost = assets.reduce((s, a) => s + Number(a.acquisition_cost || a.current_value), 0);
              const totalCurrent = assets.reduce((s, a) => s + Number(a.current_value), 0);
              const gain = totalCurrent - totalCost;
              const pct = totalCost > 0 ? ((totalCurrent - totalCost) / totalCost) * 100 : 0;
              return (
                <>
                  <p className={`text-lg font-bold ${gain >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                    {gain >= 0 ? '+' : ''}{fmt(gain)}
                  </p>
                  <p className={`text-xs font-semibold ${gain >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                    {gain >= 0 ? '+' : ''}{pct.toFixed(1)}%
                  </p>
                </>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Diversification breakdown */}
      <Card className="rounded-2xl border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-primary" />
            {isFr ? 'Répartition par type' : 'Breakdown by Type'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {diversification.map(d => (
            <div key={d.type} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{getTypeLabel(d.type)}</span>
                <span className="text-muted-foreground">{fmt(d.value)} · {d.pct.toFixed(1)}%</span>
              </div>
              <Progress value={d.pct} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Yield by type */}
      <Card className="rounded-2xl border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            {isFr ? 'Rendement par type d\'actif' : 'Yield by Asset Type'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left p-2 font-semibold text-muted-foreground text-xs">{isFr ? 'Type' : 'Type'}</th>
                  <th className="text-right p-2 font-semibold text-muted-foreground text-xs">{isFr ? 'Coût' : 'Cost'}</th>
                  <th className="text-right p-2 font-semibold text-muted-foreground text-xs">{isFr ? 'Valeur actuelle' : 'Current'}</th>
                  <th className="text-right p-2 font-semibold text-muted-foreground text-xs">{isFr ? 'Gain/Perte' : 'Gain/Loss'}</th>
                  <th className="text-right p-2 font-semibold text-muted-foreground text-xs">%</th>
                </tr>
              </thead>
              <tbody>
                {yieldByType.map(y => (
                  <tr key={y.type} className="border-b border-border/30">
                    <td className="p-2 font-medium">{getTypeLabel(y.type)}</td>
                    <td className="text-right p-2 text-muted-foreground">{fmt(y.cost)}</td>
                    <td className="text-right p-2">{fmt(y.current)}</td>
                    <td className={`text-right p-2 font-semibold ${y.gain >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                      {y.gain >= 0 ? '+' : ''}{fmt(y.gain)}
                    </td>
                    <td className={`text-right p-2 font-semibold ${y.pct >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                      {y.pct >= 0 ? '+' : ''}{y.pct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WealthAnalysisTab;
