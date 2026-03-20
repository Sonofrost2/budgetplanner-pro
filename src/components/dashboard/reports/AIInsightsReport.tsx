import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { useReportsData, useDebts, useBudgets, useSavingsGoals } from '@/hooks/useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Sparkles, Loader2, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Info, ShieldAlert, Heart } from 'lucide-react';
import { toast } from 'sonner';

const healthColors: Record<string, string> = {
  excellent: 'text-secondary',
  good: 'text-primary',
  fair: 'text-yellow-500',
  poor: 'text-orange-500',
  critical: 'text-destructive',
};

const healthLabels: Record<string, Record<string, string>> = {
  excellent: { fr: 'Excellente', en: 'Excellent' },
  good: { fr: 'Bonne', en: 'Good' },
  fair: { fr: 'Correcte', en: 'Fair' },
  poor: { fr: 'Préoccupante', en: 'Poor' },
  critical: { fr: 'Critique', en: 'Critical' },
};

const insightIcons: Record<string, React.ReactNode> = {
  positive: <CheckCircle className="w-4 h-4 text-secondary" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
  danger: <ShieldAlert className="w-4 h-4 text-destructive" />,
  info: <Info className="w-4 h-4 text-primary" />,
};

const AIInsightsReport = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const t = dashT[locale];
  const fmt = (n: number) => fmtCurrency(n, locale);

  const { data: reportsData } = useReportsData(locale);
  const { data: debts = [] } = useDebts();
  const { data: budgets = [] } = useBudgets();
  const { data: savings = [] } = useSavingsGoals();

  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const monthlyData = reportsData?.monthlyData || [];
      const categoryData = reportsData?.categoryData || [];

      const savingsProgress = savings.map(s => ({
        name: s.name,
        current: s.current_amount,
        target: s.target_amount,
        pct: Number(s.target_amount) > 0 ? Math.round((Number(s.current_amount) / Number(s.target_amount)) * 100) : 0,
      }));

      const budgetPerformance = budgets.map(b => ({
        name: b.name,
        amount: b.amount,
        type: b.budget_type,
        period: b.period,
        category: (b.categories as any)?.name,
      }));

      const debtsOverview = debts.map(d => ({
        creditor: d.creditor_name,
        remaining: Number(d.total_amount) - Number(d.paid_amount),
        dueDate: d.due_date,
      }));

      const { data, error } = await supabase.functions.invoke('ai-report-insights', {
        body: { monthlyData, categoryData, savingsProgress, budgetPerformance, debtsOverview, locale },
      });
      if (error) throw error;
      setInsights(data);
    } catch (e: any) {
      toast.error(e.message || 'AI error');
    } finally {
      setLoading(false);
    }
  };

  const trendIcon = insights?.monthly_trend === 'improving'
    ? <TrendingUp className="w-4 h-4 text-secondary" />
    : insights?.monthly_trend === 'declining'
    ? <TrendingDown className="w-4 h-4 text-destructive" />
    : <Minus className="w-4 h-4 text-muted-foreground" />;

  return (
    <div className="space-y-4">
      {!insights && !loading && (
        <Card className="border border-dashed border-primary/30 shadow-none rounded-2xl">
          <CardContent className="py-12 text-center space-y-4">
            <Sparkles className="w-12 h-12 text-primary/40 mx-auto" />
            <div>
              <h3 className="text-lg font-bold">{locale === 'fr' ? 'Analyse IA de vos finances' : 'AI Financial Analysis'}</h3>
              <p className="text-sm text-muted-foreground mt-1">{locale === 'fr' ? 'Obtenez un score de santé financière, des insights personnalisés et des recommandations actionnables.' : 'Get a financial health score, personalized insights and actionable recommendations.'}</p>
            </div>
            <Button onClick={handleGenerate} className="text-primary-foreground rounded-xl" style={{ background: 'var(--gradient-primary)' }}>
              <Sparkles className="w-4 h-4 mr-2" />{locale === 'fr' ? 'Générer l\'analyse' : 'Generate Analysis'}
            </Button>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Card className="border-none shadow-[var(--shadow-card)] rounded-2xl">
          <CardContent className="py-16 flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{locale === 'fr' ? 'Analyse en cours de vos données financières...' : 'Analyzing your financial data...'}</p>
          </CardContent>
        </Card>
      )}

      {insights && !insights.error && (
        <>
          {/* Health Score */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-none shadow-[var(--shadow-card)] rounded-2xl md:col-span-1">
              <CardContent className="py-6 text-center space-y-3">
                <Heart className={`w-8 h-8 mx-auto ${healthColors[insights.health_label] || 'text-primary'}`} />
                <div>
                  <p className={`text-4xl font-extrabold ${healthColors[insights.health_label] || 'text-primary'}`}>{insights.health_score}</p>
                  <p className="text-xs text-muted-foreground">/100</p>
                </div>
                <p className={`text-sm font-bold ${healthColors[insights.health_label] || ''}`}>
                  {healthLabels[insights.health_label]?.[locale === 'fr' ? 'fr' : 'en'] || insights.health_label}
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  {trendIcon}
                  <span>{locale === 'fr' ? 'Tendance' : 'Trend'}: {
                    insights.monthly_trend === 'improving' ? (locale === 'fr' ? 'En amélioration' : 'Improving') :
                    insights.monthly_trend === 'declining' ? (locale === 'fr' ? 'En baisse' : 'Declining') :
                    (locale === 'fr' ? 'Stable' : 'Stable')
                  }</span>
                </div>
                <Progress value={insights.health_score} className="h-2 rounded-full" />
              </CardContent>
            </Card>

            <Card className="border-none shadow-[var(--shadow-card)] rounded-2xl md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{locale === 'fr' ? 'Résumé' : 'Summary'}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{insights.summary}</p>
                <div className="flex items-center gap-4 text-sm">
                  <div className="bg-muted/30 rounded-lg px-3 py-2">
                    <span className="text-xs text-muted-foreground block">{locale === 'fr' ? 'Taux d\'épargne' : 'Savings rate'}</span>
                    <span className={`font-bold ${insights.savings_rate >= 20 ? 'text-secondary' : insights.savings_rate >= 10 ? 'text-yellow-500' : 'text-destructive'}`}>{insights.savings_rate}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Key Insights */}
          {insights.key_insights && insights.key_insights.length > 0 && (
            <Card className="border-none shadow-[var(--shadow-card)] rounded-2xl">
              <CardHeader className="pb-2"><CardTitle className="text-base">{locale === 'fr' ? 'Points clés' : 'Key Insights'}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {insights.key_insights.map((insight: any, i: number) => (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${
                      insight.type === 'positive' ? 'bg-secondary/5' :
                      insight.type === 'warning' ? 'bg-yellow-500/5' :
                      insight.type === 'danger' ? 'bg-destructive/5' : 'bg-primary/5'
                    }`}>
                      <span className="mt-0.5">{insightIcons[insight.type] || insightIcons.info}</span>
                      <div>
                        <p className="text-sm font-semibold">{insight.icon} {insight.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{insight.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {insights.recommendations && insights.recommendations.length > 0 && (
            <Card className="border-none shadow-[var(--shadow-card)] rounded-2xl">
              <CardHeader className="pb-2"><CardTitle className="text-base">{locale === 'fr' ? 'Recommandations' : 'Recommendations'}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {insights.recommendations.sort((a: any, b: any) => a.priority - b.priority).map((rec: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/20">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">{rec.priority}</div>
                      <div>
                        <p className="text-sm font-medium">{rec.action}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">→ {rec.expected_impact}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Anomalies */}
          {insights.anomalies && insights.anomalies.length > 0 && (
            <Card className="border-none shadow-[var(--shadow-card)] rounded-2xl">
              <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-yellow-500" />{locale === 'fr' ? 'Anomalies détectées' : 'Anomalies Detected'}</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {insights.anomalies.map((anomaly: any, i: number) => (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${
                      anomaly.severity === 'high' ? 'bg-destructive/5' :
                      anomaly.severity === 'medium' ? 'bg-yellow-500/5' : 'bg-muted/20'
                    }`}>
                      <AlertTriangle className={`w-4 h-4 mt-0.5 ${
                        anomaly.severity === 'high' ? 'text-destructive' :
                        anomaly.severity === 'medium' ? 'text-yellow-500' : 'text-muted-foreground'
                      }`} />
                      <div>
                        <p className="text-sm font-semibold">{anomaly.category}</p>
                        <p className="text-xs text-muted-foreground">{anomaly.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="text-center">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={handleGenerate}>
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />{locale === 'fr' ? 'Régénérer l\'analyse' : 'Regenerate Analysis'}
            </Button>
          </div>
        </>
      )}

      {insights?.error && (
        <Card className="border-none shadow-[var(--shadow-card)] rounded-2xl">
          <CardContent className="py-8 text-center">
            <p className="text-destructive">{insights.error}</p>
            <Button variant="outline" size="sm" className="mt-4 rounded-xl" onClick={handleGenerate}>{locale === 'fr' ? 'Réessayer' : 'Retry'}</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AIInsightsReport;
