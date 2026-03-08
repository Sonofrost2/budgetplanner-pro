import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { useSubscription } from '@/hooks/useSubscription';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';
import { Loader2, Sparkles, TrendingUp, TrendingDown, Lightbulb, AlertTriangle, Lock } from 'lucide-react';
import { toast } from 'sonner';
import UpgradeBanner from '@/components/dashboard/UpgradeBanner';

const ForecastsPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const { canUseForecast } = useSubscription();
  const t = dashT[locale];
  const [loading, setLoading] = useState(false);
  const [forecast, setForecast] = useState<any>(null);
  const [rawTxData, setRawTxData] = useState<any[] | null>(null);

  const fmt = (n: number) => fmtCurrency(n, locale);

  useEffect(() => {
    if (!user) return;
    const now = new Date();
    const sixAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0];
    Promise.all([
      supabase.from('transactions').select('type, amount, date, category_id, categories(name)').eq('user_id', user.id).gte('date', sixAgo),
      supabase.from('categories').select('id, name, type').eq('user_id', user.id),
    ]).then(([txRes, catRes]) => {
      setRawTxData(txRes.data || []);
    });
  }, [user]);

  const generateForecast = async () => {
    if (!user || !rawTxData) return;
    setLoading(true);
    try {
      const { data: categories } = await supabase.from('categories').select('id, name, type').eq('user_id', user.id);
      const { data, error } = await supabase.functions.invoke('ai-forecast', {
        body: { transactions: rawTxData, categories: categories || [], locale },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      setForecast(data);
    } catch (e: any) {
      toast.error(e.message || 'Error generating forecast');
    } finally {
      setLoading(false);
    }
  };

  const hasData = rawTxData && rawTxData.length > 0;

  return (
    <div className="space-y-6">
      {!canUseForecast && (
        <UpgradeBanner message={t.upgradeForecast} />
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display">{t.forecastTitle}</h2>
          <p className="text-muted-foreground mt-1">{t.forecastSubtitle}</p>
        </div>
        <Button size="sm" className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }} onClick={generateForecast} disabled={loading || !hasData || !canUseForecast}>
          {!canUseForecast ? <Lock className="w-4 h-4 mr-1" /> : loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
          {loading ? t.generating : t.generateForecast}
        </Button>
      </div>

      {!hasData && (
        <Card className="border-none shadow-[var(--shadow-card)]">
          <CardContent className="py-12 text-center">
            <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">{t.noData}</p>
          </CardContent>
        </Card>
      )}

      {forecast && (
        <Tabs defaultValue="analysis">
          <TabsList>
            <TabsTrigger value="analysis">{t.analysis}</TabsTrigger>
            <TabsTrigger value="detailed">{t.detailed}</TabsTrigger>
            <TabsTrigger value="global">{t.global}</TabsTrigger>
          </TabsList>

          {/* Analysis Tab */}
          <TabsContent value="analysis">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <Card className="border-none shadow-[var(--shadow-card)]">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <TrendingUp className="w-4 h-4 text-secondary" />{t.avgIncome}
                  </div>
                  <p className="text-2xl font-bold text-secondary">{fmt(forecast.analysis.avg_monthly_income)}</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-[var(--shadow-card)]">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <TrendingDown className="w-4 h-4 text-destructive" />{t.avgExpenses}
                  </div>
                  <p className="text-2xl font-bold text-destructive">{fmt(forecast.analysis.avg_monthly_expenses)}</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-[var(--shadow-card)]">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Sparkles className="w-4 h-4 text-primary" />{t.savingsRate}
                  </div>
                  <p className="text-2xl font-bold text-primary">{forecast.analysis.savings_rate}%</p>
                </CardContent>
              </Card>
            </div>

            {/* Top expenses */}
            {forecast.analysis.top_expense_categories?.length > 0 && (
              <Card className="border-none shadow-[var(--shadow-card)] mb-4">
                <CardHeader><CardTitle className="text-base">{t.topExpenses}</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={forecast.analysis.top_expense_categories}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Trends & Recommendations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-none shadow-[var(--shadow-card)]">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4" />{t.trends}</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-muted-foreground">{forecast.analysis.trends}</p></CardContent>
              </Card>
              <Card className="border-none shadow-[var(--shadow-card)]">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Lightbulb className="w-4 h-4" />{t.recommendations}</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {forecast.analysis.recommendations?.map((r: string, i: number) => (
                      <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="text-primary">•</span>{r}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Detailed Tab */}
          <TabsContent value="detailed">
            <div className="grid gap-4">
              {forecast.detailed_forecasts?.map((df: any, i: number) => (
                <Card key={i} className="border-none shadow-[var(--shadow-card)]">
                  <CardHeader><CardTitle className="text-base">{df.category}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={df.monthly_projections}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="optimistic" stroke="hsl(var(--secondary))" strokeWidth={2} name={t.optimistic} />
                          <Line type="monotone" dataKey="realistic" stroke="hsl(var(--primary))" strokeWidth={2} name={t.realistic} />
                          <Line type="monotone" dataKey="pessimistic" stroke="hsl(var(--destructive))" strokeWidth={2} name={t.pessimistic} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Global Tab */}
          <TabsContent value="global">
            <Card className="border-none shadow-[var(--shadow-card)]">
              <CardHeader><CardTitle className="text-base">{t.incomeVsExpenses} — {t.projected}</CardTitle></CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={forecast.global_forecasts}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="optimistic_balance" stroke="hsl(var(--secondary))" strokeWidth={2} name={`${t.optimistic}`} />
                      <Line type="monotone" dataKey="realistic_balance" stroke="hsl(var(--primary))" strokeWidth={2} name={`${t.realistic}`} />
                      <Line type="monotone" dataKey="pessimistic_balance" stroke="hsl(var(--destructive))" strokeWidth={2} name={`${t.pessimistic}`} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default ForecastsPage;
