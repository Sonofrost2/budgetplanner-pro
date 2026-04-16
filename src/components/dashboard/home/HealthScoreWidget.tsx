import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Heart, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { fetchHealthScore, scoreLabel, type HealthScore } from '@/lib/healthScore';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';

export const HealthScoreWidget = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const fr = locale === 'fr';
  const [data, setData] = useState<HealthScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchHealthScore(user.id).then(d => { setData(d); setLoading(false); });
  }, [user]);

  if (loading) {
    return (
      <Card className="p-4 flex items-center justify-center h-32 bg-card/40 backdrop-blur-xl border border-border/40 rounded-2xl">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (!data) return null;
  const sl = scoreLabel(data.score, fr ? 'fr' : 'en');

  return (
    <Card className="p-5 bg-card/40 backdrop-blur-xl border border-border/40 rounded-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">{fr ? 'Score financier' : 'Financial score'}</h3>
        </div>
        <span className={`text-xs font-bold ${sl.color}`}>{sl.label}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-4xl font-bold tabular-nums">{data.score}</span>
        <span className="text-sm text-muted-foreground mb-1">/100</span>
      </div>
      <Progress value={data.score} className="h-2" />
      <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/40">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3 text-emerald-500" />
          <span className="text-muted-foreground">{fr ? 'Épargne' : 'Savings'}</span>
          <span className="font-semibold ml-auto">{data.savings_rate}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingDown className="w-3 h-3 text-amber-500" />
          <span className="text-muted-foreground">{fr ? 'Dette' : 'Debt'}</span>
          <span className="font-semibold ml-auto">{data.debt_ratio}%</span>
        </div>
      </div>
    </Card>
  );
};
