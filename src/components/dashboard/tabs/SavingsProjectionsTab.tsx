import { useMemo } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Target, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  goals: any[];
  fmt: (n: number) => string;
}

const SavingsProjectionsTab = ({ goals, fmt }: Props) => {
  const { locale } = useLanguage();
  const t = dashT[locale];

  const totalCurrent = goals.reduce((s, g) => s + Number(g.current_amount), 0);
  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0);
  const globalPct = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;

  // Projection: if each goal has monthly_contribution, project 12 months
  const projectionData = useMemo(() => {
    const months: { month: string; projected: number; target: number }[] = [];
    for (let i = 0; i <= 12; i++) {
      let projected = 0;
      goals.forEach(g => {
        const monthly = Number(g.monthly_contribution) || 0;
        const rate = Number((g as any).interest_rate) || 0;
        let amount = Number(g.current_amount);
        for (let m = 0; m < i; m++) {
          amount += monthly;
          amount += amount * (rate / 100 / 12);
        }
        projected += amount;
      });
      const label = i === 0 ? (locale === 'fr' ? 'Maintenant' : 'Now') : `M+${i}`;
      months.push({ month: label, projected, target: totalTarget });
    }
    return months;
  }, [goals, totalTarget, locale]);

  if (goals.length === 0) {
    return (
      <Card className="border border-border/50 rounded-2xl">
        <CardContent className="py-12 text-center">
          <Target className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">{t.noDataYet}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-border/50 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.savingsTotal}</p>
            <p className="text-xl font-bold">{fmt(totalCurrent)}</p>
          </CardContent>
        </Card>
        <Card className="border border-border/50 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.target}</p>
            <p className="text-xl font-bold">{fmt(totalTarget)}</p>
          </CardContent>
        </Card>
        <Card className="border border-border/50 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.progress}</p>
            <div className="flex items-center gap-2">
              <Progress value={Math.min(globalPct, 100)} className="h-2 flex-1" />
              <span className="text-sm font-bold">{globalPct.toFixed(0)}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border/50 rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            {locale === 'fr' ? 'Projection sur 12 mois' : '12-month Projection'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projectionData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Line type="monotone" dataKey="projected" stroke="hsl(var(--primary))" strokeWidth={2} name={locale === 'fr' ? 'Projeté' : 'Projected'} />
                <Line type="monotone" dataKey="target" stroke="hsl(var(--destructive))" strokeDasharray="5 5" strokeWidth={1.5} name={t.target} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Per-goal detail */}
      <div className="space-y-3">
        {goals.map(g => {
          const pct = Number(g.target_amount) > 0 ? (Number(g.current_amount) / Number(g.target_amount)) * 100 : 0;
          return (
            <Card key={g.id} className="border border-border/50 rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm flex items-center gap-2">
                    <span>{g.icon}</span> {g.name}
                  </span>
                  <span className="text-sm font-bold">{fmt(Number(g.current_amount))} / {fmt(Number(g.target_amount))}</span>
                </div>
                <Progress value={Math.min(pct, 100)} className="h-2" />
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-muted-foreground">{pct.toFixed(0)}%</span>
                  {g.deadline && <span className="text-xs text-muted-foreground">{locale === 'fr' ? 'Échéance' : 'Deadline'}: {new Date(g.deadline).toLocaleDateString()}</span>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default SavingsProjectionsTab;
