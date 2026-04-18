import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Gem, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { useNavigate } from 'react-router-dom';
import { liveSavingsTotal } from '@/lib/savingsLogic';

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--secondary))',
  'hsl(var(--accent))',
  'hsl(var(--chart-4, 280 65% 60%))',
  'hsl(var(--chart-5, 340 75% 55%))',
  'hsl(var(--muted-foreground))',
];

const TYPE_LABELS: Record<string, { fr: string; en: string }> = {
  real_estate: { fr: 'Immobilier', en: 'Real Estate' },
  vehicle: { fr: 'Véhicules', en: 'Vehicles' },
  financial: { fr: 'Investissements', en: 'Investments' },
  savings: { fr: 'Épargne', en: 'Savings' },
  jewelry: { fr: 'Bijoux', en: 'Jewelry' },
  other: { fr: 'Autre', en: 'Other' },
};

interface Props {
  fmt: (n: number) => string;
  t: any;
  locale: string;
}

export const WealthWidget = ({ fmt, t, locale }: Props) => {
  const { user } = useAuth();
  const isFr = locale === 'fr';
  const navigate = useNavigate();

  const { data: assets = [] } = useQuery({
    queryKey: ['assets-widget', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('assets').select('asset_type, current_value, acquisition_cost')
        .eq('user_id', user!.id);
      return data || [];
    },
    enabled: !!user,
    staleTime: 60000,
  });

  const { data: savingsTotal = 0 } = useQuery({
    queryKey: ['savings-widget-wealth-live', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('savings_goals')
        .select('current_amount, status, paused_at, deleted_at')
        .eq('user_id', user!.id)
        .is('deleted_at', null);
      return liveSavingsTotal(data || []);
    },
    enabled: !!user,
    staleTime: 60000,
  });

  const { data: debtTotal = 0 } = useQuery({
    queryKey: ['debts-widget-wealth', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('debts').select('total_amount, paid_amount').eq('user_id', user!.id);
      return (data || []).reduce((s, d) => s + (Number(d.total_amount) - Number(d.paid_amount || 0)), 0);
    },
    enabled: !!user,
    staleTime: 60000,
  });

  const totalAssets = assets.reduce((s, a) => s + Number(a.current_value), 0);
  const totalAcq = assets.reduce((s, a) => s + Number(a.acquisition_cost || 0), 0);
  const netWorth = totalAssets + savingsTotal - debtTotal;
  const gain = totalAssets - totalAcq;

  const pieData = useMemo(() => {
    const byType: Record<string, number> = {};
    assets.forEach(a => { byType[a.asset_type] = (byType[a.asset_type] || 0) + Number(a.current_value); });
    if (savingsTotal > 0) byType['savings'] = (byType['savings'] || 0) + savingsTotal;
    return Object.entries(byType)
      .filter(([, v]) => v > 0)
      .map(([type, value], i) => ({
        name: TYPE_LABELS[type]?.[isFr ? 'fr' : 'en'] || type,
        value,
        color: COLORS[i % COLORS.length],
      }));
  }, [assets, savingsTotal, isFr]);

  const total = totalAssets + savingsTotal;

  return (
    <Card className="rounded-2xl border-border/50 cursor-pointer hover:shadow-lg transition-shadow"
      onClick={() => navigate('/dashboard/wealth')}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Gem className="w-4 h-4 text-primary" />
          {isFr ? 'Patrimoine' : 'Wealth'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase font-semibold">{isFr ? 'Valeur nette' : 'Net Worth'}</p>
          <p className="text-lg font-extrabold tabular-nums">
            <AnimatedNumber value={netWorth} format={fmt} />
          </p>
          {gain !== 0 && (
            <p className={`text-[10px] font-bold flex items-center gap-0.5 ${gain >= 0 ? 'text-secondary' : 'text-destructive'}`}>
              {gain >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {gain >= 0 ? '+' : ''}{fmt(gain)}
            </p>
          )}
        </div>

        {pieData.length > 0 ? (
          <div className="flex items-center gap-3">
            <ResponsiveContainer width={80} height={80}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={22} outerRadius={36}
                  paddingAngle={3} dataKey="value" stroke="none">
                  {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1">
              {pieData.slice(0, 4).map((d, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[10px]">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="truncate flex-1">{d.name}</span>
                  <span className="font-bold tabular-nums">{total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}%</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground">{isFr ? 'Ajoutez des actifs' : 'Add assets'}</p>
        )}
      </CardContent>
    </Card>
  );
};
