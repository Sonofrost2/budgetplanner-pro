import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { useSubscription } from '@/hooks/useSubscription';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { useForecastRawTx, useCategories } from '@/hooks/useDashboardData';
import { Button } from '@/components/ui/button';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Loader2, Sparkles, TrendingUp, TrendingDown, Minus, AlertTriangle, Lock, Lightbulb, Shield, ChevronDown, Zap, Target, Brain, ArrowUpRight, ArrowDownRight, PiggyBank } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import UpgradeBanner from '@/components/dashboard/UpgradeBanner';

const LOADING_STEPS_FR = [
  '🔍 Analyse des revenus…',
  '📊 Calcul des tendances…',
  '🤖 Génération des projections…',
  '💡 Préparation des recommandations…',
];
const LOADING_STEPS_EN = [
  '🔍 Analyzing income…',
  '📊 Calculating trends…',
  '🤖 Generating projections…',
  '💡 Preparing recommendations…',
];

// ─── Health Gauge ─────────────────────────────────────────
const HealthGauge = ({ score, label }: { score: number; label: string }) => {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color =
    score >= 75 ? 'hsl(var(--secondary))' :
    score >= 50 ? 'hsl(var(--primary))' :
    score >= 25 ? 'hsl(38 92% 50%)' :
    'hsl(var(--destructive))';

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-36 h-36">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
          <motion.circle
            cx="60" cy="60" r={radius} fill="none"
            stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - progress }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold font-display">{score}</span>
          <span className="text-[10px] text-muted-foreground">/100</span>
        </div>
      </div>
      <span className="mt-2 text-sm font-semibold" style={{ color }}>{label}</span>
    </div>
  );
};

// ─── Severity badge ───────────────────────────────────────
const SeverityBadge = ({ severity }: { severity: string }) => {
  const cls =
    severity === 'high' ? 'bg-destructive/10 text-destructive border-destructive/20' :
    severity === 'medium' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
    'bg-secondary/10 text-secondary border-secondary/20';
  const label = severity === 'high' ? '⚠️' : severity === 'medium' ? '⚡' : 'ℹ️';
  return <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}>{label} {severity}</span>;
};

// ─── Difficulty badge ─────────────────────────────────────
const DifficultyBadge = ({ difficulty, t }: { difficulty: string; t: any }) => {
  const cls =
    difficulty === 'easy' ? 'bg-secondary/10 text-secondary' :
    difficulty === 'medium' ? 'bg-primary/10 text-primary' :
    'bg-destructive/10 text-destructive';
  const label = difficulty === 'easy' ? t.difficultyEasy : difficulty === 'medium' ? t.difficultyMedium : t.difficultyHard;
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
};

// ─── Trend icon ───────────────────────────────────────────
const TrendIcon = ({ trend }: { trend: string }) => {
  if (trend === 'up') return <ArrowUpRight className="w-4 h-4 text-destructive" />;
  if (trend === 'down') return <ArrowDownRight className="w-4 h-4 text-secondary" />;
  return <Minus className="w-4 h-4 text-muted-foreground" />;
};

// ─── Section wrapper ──────────────────────────────────────
const Section = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay, ease: 'easeOut' }}
  >
    {children}
  </motion.div>
);

// ─── Custom tooltip ───────────────────────────────────────
const GlassTooltip = ({ active, payload, label, fmt }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl p-3 border border-border/50 shadow-lg text-xs">
      <p className="font-semibold mb-1.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────
const ForecastsPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const { canUseForecast } = useSubscription();
  const t = dashT[locale];
  const fmt = (n: number) => fmtCurrency(n, locale);

  const { data: rawTxData } = useForecastRawTx();
  const { data: categoriesData } = useCategories();
  const [loading, setLoading] = useState(false);
  const [forecast, setForecast] = useState<any>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [chartMode, setChartMode] = useState<'balance' | 'income' | 'expenses'>('balance');

  const hasData = rawTxData && rawTxData.length > 0;
  const steps = locale === 'fr' ? LOADING_STEPS_FR : LOADING_STEPS_EN;

  // Cycle loading steps
  useEffect(() => {
    if (!loading) return;
    setLoadingStep(0);
    const interval = setInterval(() => setLoadingStep(s => (s + 1) % steps.length), 2500);
    return () => clearInterval(interval);
  }, [loading, steps.length]);

  // Restore from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('forecast_data');
    if (saved) {
      try { setForecast(JSON.parse(saved)); } catch {}
    }
  }, []);

  const generateForecast = async () => {
    if (!user || !rawTxData) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-forecast', {
        body: { transactions: rawTxData, categories: categoriesData || [], locale },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      setForecast(data);
      localStorage.setItem('forecast_data', JSON.stringify(data));
    } catch (e: any) {
      toast.error(e.message || 'Error generating forecast');
    } finally {
      setLoading(false);
    }
  };

  // Chart data keys based on mode
  const chartKeys = useMemo(() => {
    if (chartMode === 'income') return { opt: 'optimistic_income', real: 'realistic_income', pess: 'pessimistic_income' };
    if (chartMode === 'expenses') return { opt: 'optimistic_expenses', real: 'realistic_expenses', pess: 'pessimistic_expenses' };
    return { opt: 'optimistic_balance', real: 'realistic_balance', pess: 'pessimistic_balance' };
  }, [chartMode]);

  return (
    <div className="space-y-6 pb-8">
      {!canUseForecast && <UpgradeBanner message={t.upgradeForecast} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-display">{t.forecastTitle}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{t.forecastSubtitle}</p>
        </div>
        <Button
          size="sm"
          className="text-primary-foreground relative overflow-hidden"
          style={{ background: 'var(--gradient-primary)' }}
          onClick={generateForecast}
          disabled={loading || !hasData || !canUseForecast}
        >
          {!canUseForecast ? <Lock className="w-4 h-4 mr-1" /> : loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
          {loading ? t.generating : t.generateForecast}
          {!forecast && !loading && canUseForecast && hasData && (
            <span className="absolute inset-0 rounded-md animate-pulse bg-white/10" />
          )}
        </Button>
      </div>

      {/* Loading state */}
      <AnimatePresence>
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="glass rounded-2xl p-8 text-center">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-16 h-16 rounded-2xl bg-primary/10 mx-auto mb-4 flex items-center justify-center"
            >
              <Brain className="w-8 h-8 text-primary" />
            </motion.div>
            <AnimatePresence mode="wait">
              <motion.p
                key={loadingStep}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-sm font-medium text-muted-foreground"
              >
                {steps[loadingStep]}
              </motion.p>
            </AnimatePresence>
            <div className="flex gap-1.5 justify-center mt-4">
              {steps.map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full transition-colors duration-300 ${i <= loadingStep ? 'bg-primary' : 'bg-muted'}`} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* No data */}
      {!hasData && !loading && (
        <div className="glass rounded-2xl p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground">{t.noData}</p>
        </div>
      )}

      {/* Forecast results */}
      {forecast && !loading && (
        <div className="space-y-6">
          {/* ── Hero: Health Score + KPIs ── */}
          <Section delay={0}>
            <div className="glass rounded-2xl p-6">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <HealthGauge score={forecast.analysis.health_score || 50} label={forecast.analysis.health_label || 'N/A'} />
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
                  <div className="rounded-xl bg-secondary/5 border border-secondary/10 p-4 text-center">
                    <TrendingUp className="w-5 h-5 text-secondary mx-auto mb-2" />
                    <p className="text-[11px] text-muted-foreground mb-1">{t.avgIncome}</p>
                    <AnimatedNumber value={forecast.analysis.avg_monthly_income} format={fmt} className="text-lg font-bold text-secondary" />
                  </div>
                  <div className="rounded-xl bg-destructive/5 border border-destructive/10 p-4 text-center">
                    <TrendingDown className="w-5 h-5 text-destructive mx-auto mb-2" />
                    <p className="text-[11px] text-muted-foreground mb-1">{t.avgExpenses}</p>
                    <AnimatedNumber value={forecast.analysis.avg_monthly_expenses} format={fmt} className="text-lg font-bold text-destructive" />
                  </div>
                  <div className="rounded-xl bg-primary/5 border border-primary/10 p-4 text-center">
                    <PiggyBank className="w-5 h-5 text-primary mx-auto mb-2" />
                    <p className="text-[11px] text-muted-foreground mb-1">{t.savingsPotential}</p>
                    <AnimatedNumber value={forecast.analysis.monthly_savings_potential || 0} format={fmt} className="text-lg font-bold text-primary" />
                  </div>
                </div>
              </div>
              {/* Savings rate bar */}
              <div className="mt-4 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">{t.savingsRate}</span>
                  <span className="font-bold">{forecast.analysis.savings_rate?.toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'var(--gradient-primary)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(forecast.analysis.savings_rate || 0, 100)}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                  />
                </div>
              </div>
            </div>
          </Section>

          {/* ── Risk Alerts ── */}
          {forecast.risk_alerts?.length > 0 && (
            <Section delay={0.1}>
              <div className="glass rounded-2xl p-5">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-destructive" /> {t.riskAlerts}
                </h3>
                <div className="space-y-2">
                  {forecast.risk_alerts.map((alert: any, i: number) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 + i * 0.08 }}
                      className="flex items-start gap-3 p-3 rounded-xl bg-background/50 border border-border/50"
                    >
                      <SeverityBadge severity={alert.severity} />
                      <p className="text-xs text-foreground/80 flex-1">{alert.message}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </Section>
          )}

          {/* ── Global Projections Chart ── */}
          <Section delay={0.2}>
            <div className="glass rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" /> {t.projectedBalance}
                </h3>
                <div className="flex gap-1 p-0.5 rounded-lg bg-muted/50">
                  {(['balance', 'income', 'expenses'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setChartMode(mode)}
                      className={`text-[10px] px-2.5 py-1 rounded-md font-medium transition-colors ${chartMode === mode ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {mode === 'balance' ? t.projectedBalance : mode === 'income' ? t.income : t.expenses}
                    </button>
                  ))}
                </div>
              </div>
              {forecast.global_forecasts?.length > 0 && (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={forecast.global_forecasts}>
                      <defs>
                        <linearGradient id="gradOptimistic" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradRealistic" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradPessimistic" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.2} />
                          <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => fmt(v)} />
                      <Tooltip content={<GlassTooltip fmt={fmt} />} />
                      <Area type="monotone" dataKey={chartKeys.opt} stroke="hsl(var(--secondary))" fill="url(#gradOptimistic)" strokeWidth={2} name={t.optimistic} />
                      <Area type="monotone" dataKey={chartKeys.real} stroke="hsl(var(--primary))" fill="url(#gradRealistic)" strokeWidth={2.5} name={t.realistic} />
                      <Area type="monotone" dataKey={chartKeys.pess} stroke="hsl(var(--destructive))" fill="url(#gradPessimistic)" strokeWidth={2} name={t.pessimistic} strokeDasharray="6 3" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
              {/* Legend */}
              <div className="flex items-center justify-center gap-6 mt-3">
                {[
                  { label: t.optimistic, color: 'hsl(var(--secondary))' },
                  { label: t.realistic, color: 'hsl(var(--primary))' },
                  { label: t.pessimistic, color: 'hsl(var(--destructive))' },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />
                    {l.label}
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* ── Top Expenses ── */}
          {forecast.analysis.top_expense_categories?.length > 0 && (
            <Section delay={0.25}>
              <div className="glass rounded-2xl p-5">
                <h3 className="text-sm font-bold mb-3">{t.topExpenses}</h3>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={forecast.analysis.top_expense_categories}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmt(v)} />
                      <Tooltip content={<GlassTooltip fmt={fmt} />} />
                      <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name={t.amount} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Section>
          )}

          {/* ── Category Details (Collapsible) ── */}
          {forecast.detailed_forecasts?.length > 0 && (
            <Section delay={0.3}>
              <div className="glass rounded-2xl p-5">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> {t.categoryInsight}
                </h3>
                <div className="space-y-2">
                  {forecast.detailed_forecasts.map((df: any, i: number) => (
                    <Collapsible key={i}>
                      <CollapsibleTrigger className="w-full">
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.35 + i * 0.05 }}
                          className="flex items-center justify-between p-3 rounded-xl bg-background/50 border border-border/50 hover:bg-muted/30 transition-colors cursor-pointer group"
                        >
                          <div className="flex items-center gap-3">
                            <TrendIcon trend={df.trend} />
                            <span className="text-sm font-semibold">{df.category}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                              <p className="text-[10px] text-muted-foreground">{t.projectedNextMonth}</p>
                              <p className="text-xs font-bold">{fmt(df.projected_next_month || 0)}</p>
                            </div>
                            <ChevronDown className="w-4 h-4 text-muted-foreground group-data-[state=open]:rotate-180 transition-transform" />
                          </div>
                        </motion.div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-3 pb-3 pt-2 space-y-3">
                          {/* Advice */}
                          <div className="flex gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
                            <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                            <p className="text-xs text-foreground/80">{df.advice}</p>
                          </div>
                          {/* Stats row */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg bg-muted/30 p-2.5 text-center">
                              <p className="text-[10px] text-muted-foreground">{t.avg3m}</p>
                              <p className="text-sm font-bold">{fmt(df.avg_last_3m || 0)}</p>
                            </div>
                            <div className="rounded-lg bg-muted/30 p-2.5 text-center">
                              <p className="text-[10px] text-muted-foreground">{t.projectedNextMonth}</p>
                              <p className="text-sm font-bold">{fmt(df.projected_next_month || 0)}</p>
                            </div>
                          </div>
                          {/* Mini chart */}
                          {df.monthly_projections?.length > 0 && (
                            <div className="h-36">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={df.monthly_projections}>
                                  <defs>
                                    <linearGradient id={`gradCat${i}`} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                    </linearGradient>
                                  </defs>
                                  <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                                  <YAxis tick={{ fontSize: 9 }} hide />
                                  <Tooltip content={<GlassTooltip fmt={fmt} />} />
                                  <Area type="monotone" dataKey="realistic" stroke="hsl(var(--primary))" fill={`url(#gradCat${i})`} strokeWidth={2} name={t.realistic} />
                                  <Area type="monotone" dataKey="optimistic" stroke="hsl(var(--secondary))" fill="none" strokeWidth={1.5} strokeDasharray="4 2" name={t.optimistic} />
                                  <Area type="monotone" dataKey="pessimistic" stroke="hsl(var(--destructive))" fill="none" strokeWidth={1.5} strokeDasharray="4 2" name={t.pessimistic} />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              </div>
            </Section>
          )}

          {/* ── Action Plan ── */}
          {forecast.action_plan?.length > 0 && (
            <Section delay={0.35}>
              <div className="glass rounded-2xl p-5">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-amber-500" /> {t.actionPlan}
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {forecast.action_plan.map((action: any, i: number) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.4 + i * 0.08 }}
                      className="p-4 rounded-xl bg-background/50 border border-border/50 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-sm font-semibold flex-1">{action.title}</h4>
                        <DifficultyBadge difficulty={action.difficulty} t={t} />
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">{action.description}</p>
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-muted-foreground">{t.impactAmount}:</span>
                        <span className="font-bold text-secondary">+{fmt(action.impact_amount || 0)}{locale === 'fr' ? '/mois' : '/mo'}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </Section>
          )}

          {/* ── Trends & Recommendations ── */}
          <Section delay={0.4}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass rounded-2xl p-5">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-primary" /> {t.trends}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{forecast.analysis.trends}</p>
              </div>
              <div className="glass rounded-2xl p-5">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
                  <Lightbulb className="w-4 h-4 text-amber-500" /> {t.recommendations}
                </h3>
                <ul className="space-y-2">
                  {forecast.analysis.recommendations?.map((r: string, i: number) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.45 + i * 0.06 }}
                      className="text-xs text-muted-foreground flex gap-2"
                    >
                      <span className="text-primary shrink-0">✦</span>{r}
                    </motion.li>
                  ))}
                </ul>
              </div>
            </div>
          </Section>
        </div>
      )}
    </div>
  );
};

export default ForecastsPage;
