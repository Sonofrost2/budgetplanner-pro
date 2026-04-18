import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Heart, TrendingUp, TrendingDown, Loader2, Scale } from 'lucide-react';
import { fetchHealthScore, fetchMonthlyRegularizationStats, scoreLabel, type HealthScore, type RegularizationStats } from '@/lib/healthScore';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { useProfile } from '@/hooks/useProfile';

export const HealthScoreWidget = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt } = useProfile();
  const fr = locale === 'fr';
  const [data, setData] = useState<HealthScore | null>(null);
  const [reg, setReg] = useState<RegularizationStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      fetchHealthScore(user.id),
      fetchMonthlyRegularizationStats(user.id),
    ]).then(([d, r]) => {
      setData(d);
      setReg(r);
      setLoading(false);
    });
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

  // Reliability tone based on count
  const regCount = reg?.count ?? 0;
  const regTone =
    regCount === 0 ? 'text-muted-foreground'
    : regCount <= 2 ? 'text-amber-500'
    : 'text-destructive';
  const regHint = fr
    ? regCount === 0 ? 'Aucune régularisation ce mois — saisie fiable ✓'
      : regCount <= 2 ? 'Quelques ajustements — surveillez votre saisie'
      : 'Nombreux ajustements — vérifiez votre saisie'
    : regCount === 0 ? 'No adjustments this month — reliable entry ✓'
      : regCount <= 2 ? 'Few adjustments — watch your data entry'
      : 'Many adjustments — check your data entry';

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
          <TrendingUp className="w-3 h-3 text-secondary" />
          <span className="text-muted-foreground">{fr ? 'Épargne' : 'Savings'}</span>
          <span className="font-semibold ml-auto">{data.savings_rate}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingDown className="w-3 h-3 text-primary" />
          <span className="text-muted-foreground">{fr ? 'Dette' : 'Debt'}</span>
          <span className="font-semibold ml-auto">{data.debt_ratio}%</span>
        </div>
      </div>

      {reg && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-xs pt-2 border-t border-border/40 cursor-help">
                <Scale className={`w-3 h-3 ${regTone}`} />
                <span className="text-muted-foreground">
                  {fr ? 'Régularisations' : 'Adjustments'}
                </span>
                <span className={`font-semibold ml-auto tabular-nums ${regTone}`}>
                  {regCount === 0
                    ? (fr ? 'Aucune' : 'None')
                    : `${fmt(Math.abs(reg.total), locale)} · ${regCount}`}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px] text-xs">
              {regHint}
              <div className="text-muted-foreground mt-1">
                {fr ? 'Plus le total est faible, plus votre saisie est fiable.' : 'The lower the total, the more reliable your entry.'}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </Card>
  );
};
