import { useMemo, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { useBudgets } from '@/hooks/useDashboardData';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { PieChart as PieChartIcon, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Calendar as CalendarIcon, CalendarDays, Download, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { abbreviateNumber, cn } from '@/lib/utils';
import { getBudgetPeriodBounds, formatDateStr, computeAnnualizedAmount } from '@/lib/budgetProjection';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

const TOOLTIP_STYLE = {
  borderRadius: '12px',
  border: 'none',
  background: 'hsl(var(--card))',
  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
  fontSize: '12px',
  padding: '8px 12px',
};

type AnalysisPeriod = 'current' | 'last_month' | 'last_3' | 'last_6' | 'last_year' | 'custom';

const BudgetAnalysisTab = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const t = dashT[locale];
  const isFr = locale === 'fr';
  const { data: budgets = [] } = useBudgets();
  const fmt = (n: number) => fmtCurrency(n, locale);

  const [analysisPeriod, setAnalysisPeriod] = useState<AnalysisPeriod>('current');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const periodLabels: Record<AnalysisPeriod, string> = {
    current: t.currentPeriod,
    last_month: t.lastMonth,
    last_3: t.last3Months,
    last_6: t.last6Months,
    last_year: t.lastYear,
    custom: isFr ? 'Personnalisé' : 'Custom',
  };

  const periodRanges = useMemo(() => {
    const now = new Date();
    return budgets.map(b => {
      let offset = 0;
      if (analysisPeriod === 'last_month') offset = 1;

      const { periodStart, periodEnd } = getBudgetPeriodBounds(
        b.period || 'monthly', now, b.reference_date, offset
      );

      let start = formatDateStr(periodStart);
      let end = formatDateStr(periodEnd);

      if (analysisPeriod === 'last_3') {
        const d = new Date(now); d.setMonth(d.getMonth() - 3);
        start = formatDateStr(new Date(d.getFullYear(), d.getMonth(), 1));
        end = formatDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      } else if (analysisPeriod === 'last_6') {
        const d = new Date(now); d.setMonth(d.getMonth() - 6);
        start = formatDateStr(new Date(d.getFullYear(), d.getMonth(), 1));
        end = formatDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      } else if (analysisPeriod === 'last_year') {
        start = `${now.getFullYear() - 1}-01-01`;
        end = `${now.getFullYear()}-12-31`;
      } else if (analysisPeriod === 'custom' && customFrom && customTo) {
        start = formatDateStr(customFrom);
        end = formatDateStr(customTo);
      }

      return {
        id: b.id,
        category_id: b.category_id,
        type: (b as any).budget_type === 'income' ? 'income' : 'expense',
        start, end,
      };
    });
  }, [budgets, analysisPeriod, customFrom, customTo]);

  const { data: spending = {} } = useQuery({
    queryKey: ['budget-analysis-spending', user?.id, analysisPeriod, customFrom?.toISOString(), customTo?.toISOString(), periodRanges.map(r => r.id).join(',')],
    queryFn: async () => {
      const map: Record<string, number> = {};
      await Promise.all(periodRanges.filter(r => r.category_id).map(async r => {
        const { data } = await supabase.rpc('get_budget_spending', {
          p_user_id: user!.id, p_category_id: r.category_id!, p_type: r.type,
          p_start_date: r.start, p_end_date: r.end,
        });
        if (data !== null) map[r.id] = Number(data);
      }));
      return map;
    },
    enabled: !!user && periodRanges.length > 0,
    staleTime: 30_000,
  });

  const expenseBudgets = budgets.filter(b => (b as any).budget_type !== 'income');

  // Compute the analysis period duration in days
  const analysisDays = useMemo(() => {
    if (periodRanges.length === 0) return 30;
    // All budgets share the same analysis window for multi-month periods
    const r = periodRanges[0];
    const s = new Date(r.start);
    const e = new Date(r.end);
    return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
  }, [periodRanges]);

  /** Normalize a budget amount to the analysis period.
   *  E.g. a weekly budget of 10k over a 90-day analysis = 10k * (90/7) ≈ 128.6k */
  const normalizeToAnalysis = (amount: number, period: string, activeDays?: string | null) => {
    // For "current" and "last_month" with the budget's own period, no normalization needed
    if (analysisPeriod === 'current' || analysisPeriod === 'last_month') return amount;

    // Period duration in days
    const periodDaysMap: Record<string, number> = {
      daily: 1, weekly: 7, monthly: 30.44, quarterly: 91.31, semi_annual: 182.63, yearly: 365.25,
    };
    const budgetPeriodDays = periodDaysMap[period] || 30.44;

    // For daily budgets with active_days, adjust
    let effectiveBudgetDays = budgetPeriodDays;
    if (period === 'daily' && activeDays) {
      const activeCount = activeDays.split(',').filter(Boolean).length;
      // Budget covers activeCount days per 7-day week
      effectiveBudgetDays = 7 / activeCount;
    }

    const periodsInAnalysis = analysisDays / effectiveBudgetDays;
    return amount * periodsInAnalysis;
  };

  const budgetAnalysis = useMemo(() => {
    return expenseBudgets.map(b => {
      const actual = spending[b.id] || 0;
      const rawAmount = Number(b.amount);
      const amount = Math.round(normalizeToAnalysis(rawAmount, b.period || 'monthly', (b as any).active_days));
      const pct = amount > 0 ? Math.min((actual / amount) * 100, 100) : 0;
      const isMax = (b as any).control_type !== 'min';
      const variance = isMax ? amount - actual : actual - amount;

      return { budget: b, actual, amount, pct, variance, rawAmount };
    });
  }, [expenseBudgets, spending, analysisDays, analysisPeriod]);

  const summary = useMemo(() => {
    const totalBudgeted = budgetAnalysis.reduce((s, a) => s + a.amount, 0);
    const totalConsumed = budgetAnalysis.reduce((s, a) => s + a.actual, 0);
    const overBudgetCount = budgetAnalysis.filter(a => a.variance < 0).length;
    const onTrackCount = budgetAnalysis.length - overBudgetCount;
    const totalSavings = budgetAnalysis.filter(a => a.variance > 0).reduce((s, a) => s + a.variance, 0);
    const totalOverspend = budgetAnalysis.filter(a => a.variance < 0).reduce((s, a) => s + Math.abs(a.variance), 0);
    const netVariance = totalSavings - totalOverspend;
    return { totalBudgeted, totalConsumed, overBudgetCount, onTrackCount, totalSavings, totalOverspend, netVariance };
  }, [budgetAnalysis]);

  const chartData = budgetAnalysis.map(a => ({
    name: a.budget.name.length > 12 ? a.budget.name.slice(0, 12) + '…' : a.budget.name,
    budget: a.amount,
    actual: a.actual,
  }));

  const [exporting, setExporting] = useState(false);

  const periodLabelForPdf = useMemo(() => {
    if (analysisPeriod === 'custom' && customFrom && customTo) {
      return `${format(customFrom, 'dd/MM/yyyy')} - ${format(customTo, 'dd/MM/yyyy')}`;
    }
    return periodLabels[analysisPeriod];
  }, [analysisPeriod, customFrom, customTo, periodLabels]);

  const handleExportPDF = useCallback(async () => {
    setExporting(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const pdfFmt = (n: number) => {
        const parts = Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        return parts;
      };

      const doc = new jsPDF();
      const title = isFr ? 'Rapport d\'Analyse Budgetaire' : 'Budget Analysis Report';
      const date = format(new Date(), 'dd/MM/yyyy HH:mm');

      // Header
      doc.setFontSize(18);
      doc.text(title, 14, 20);
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text(`${isFr ? 'Periode' : 'Period'}: ${periodLabelForPdf}  |  ${isFr ? 'Genere le' : 'Generated'}: ${date}`, 14, 28);
      doc.setTextColor(0);

      // Summary section
      let y = 38;
      doc.setFontSize(13);
      doc.text(isFr ? 'Resume Global' : 'Global Summary', 14, y);
      y += 8;

      const summaryData = [
        [isFr ? 'Total budgete' : 'Total Budgeted', pdfFmt(summary.totalBudgeted)],
        [isFr ? 'Total consomme' : 'Total Consumed', pdfFmt(summary.totalConsumed)],
        [isFr ? 'Taux de consommation' : 'Consumption Rate', `${summary.totalBudgeted > 0 ? Math.round((summary.totalConsumed / summary.totalBudgeted) * 100) : 0}%`],
        [isFr ? 'Budgets en bonne voie' : 'On Track', String(summary.onTrackCount)],
        [isFr ? 'Budgets en alerte' : 'In Alert', String(summary.overBudgetCount)],
        [isFr ? 'Total economies' : 'Total Savings', pdfFmt(Math.round(summary.totalSavings))],
        [isFr ? 'Total depassements' : 'Total Overspend', pdfFmt(Math.round(summary.totalOverspend))],
        [isFr ? 'Variance nette' : 'Net Variance', `${summary.netVariance >= 0 ? '+' : ''}${pdfFmt(Math.round(summary.netVariance))}`],
      ];

      autoTable(doc, {
        startY: y,
        head: [[isFr ? 'Indicateur' : 'Indicator', isFr ? 'Valeur' : 'Value']],
        body: summaryData,
        theme: 'striped',
        headStyles: { fillColor: [108, 99, 255], fontSize: 10 },
        styles: { fontSize: 9 },
        margin: { left: 14, right: 14 },
      });

      y = (doc as any).lastAutoTable.finalY + 12;

      // Detail table
      doc.setFontSize(13);
      doc.text(isFr ? 'Detail par Budget' : 'Budget Details', 14, y);
      y += 6;

      const periodLabelsShort: Record<string, string> = {
        daily: isFr ? 'Jour' : 'Daily',
        weekly: isFr ? 'Sem.' : 'Weekly',
        monthly: isFr ? 'Mois' : 'Monthly',
        quarterly: isFr ? 'Trim.' : 'Quarterly',
        semi_annual: isFr ? 'Sem.' : 'Semi-annual',
        yearly: isFr ? 'Annuel' : 'Yearly',
      };

      const detailHead = [
        isFr ? 'Budget' : 'Budget',
        isFr ? 'Periode' : 'Period',
        isFr ? 'Montant brut' : 'Raw Amount',
        isFr ? 'Normalise' : 'Normalized',
        isFr ? 'Realise' : 'Actual',
        '%',
        isFr ? 'Variance' : 'Variance',
        isFr ? 'Statut' : 'Status',
      ];

      const detailBody = budgetAnalysis.map(a => [
        a.budget.name,
        periodLabelsShort[a.budget.period || 'monthly'] || a.budget.period,
        pdfFmt(a.rawAmount),
        a.rawAmount !== a.amount ? pdfFmt(a.amount) : '-',
        pdfFmt(a.actual),
        `${Math.round(a.pct)}%`,
        `${a.variance >= 0 ? '+' : ''}${pdfFmt(Math.round(a.variance))}`,
        a.variance >= 0 ? (isFr ? 'OK' : 'OK') : (isFr ? 'Depasse' : 'Over'),
      ]);

      autoTable(doc, {
        startY: y,
        head: [detailHead],
        body: detailBody,
        theme: 'striped',
        headStyles: { fillColor: [108, 99, 255], fontSize: 8 },
        styles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: 35 },
          7: { fontStyle: 'bold' },
        },
        margin: { left: 14, right: 14 },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 7) {
            const val = data.cell.raw;
            if (val === 'OK') {
              data.cell.styles.textColor = [34, 139, 34];
            } else {
              data.cell.styles.textColor = [220, 38, 38];
            }
          }
          if (data.section === 'body' && data.column.index === 6) {
            const val = String(data.cell.raw);
            if (val.startsWith('+')) {
              data.cell.styles.textColor = [34, 139, 34];
            } else if (val.startsWith('-')) {
              data.cell.styles.textColor = [220, 38, 38];
            }
          }
        },
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Budget Planner - ${title}`, 14, doc.internal.pageSize.height - 10);
        doc.text(`${i}/${pageCount}`, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - 10);
      }

      doc.save(`analyse-budgetaire-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success(isFr ? 'PDF exporté avec succès' : 'PDF exported successfully');
    } catch (err: any) {
      toast.error(err.message || 'Export error');
    } finally {
      setExporting(false);
    }
  }, [budgetAnalysis, summary, isFr, periodLabelForPdf, fmt]);

  if (budgets.length === 0) {
    return (
      <Card className="border border-border/50 rounded-2xl">
        <CardContent className="py-12 text-center">
          <PieChartIcon className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">{t.noDataYet}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-muted-foreground" />
          {t.budgetAnalysis}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={analysisPeriod} onValueChange={(v) => setAnalysisPeriod(v as AnalysisPeriod)}>
            <SelectTrigger className="w-[180px] h-8 rounded-xl text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(periodLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {analysisPeriod === 'custom' && (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('h-8 rounded-xl text-xs gap-1.5', !customFrom && 'text-muted-foreground')}>
                    <CalendarDays className="w-3.5 h-3.5" />
                    {customFrom ? format(customFrom, 'dd MMM yyyy', { locale: isFr ? fr : undefined }) : (isFr ? 'Début' : 'Start')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} initialFocus className={cn('p-3 pointer-events-auto')} />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('h-8 rounded-xl text-xs gap-1.5', !customTo && 'text-muted-foreground')}>
                    <CalendarDays className="w-3.5 h-3.5" />
                    {customTo ? format(customTo, 'dd MMM yyyy', { locale: isFr ? fr : undefined }) : (isFr ? 'Fin' : 'End')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customTo} onSelect={setCustomTo} initialFocus className={cn('p-3 pointer-events-auto')} />
                </PopoverContent>
              </Popover>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-xl text-xs gap-1.5"
            onClick={handleExportPDF}
            disabled={exporting || budgetAnalysis.length === 0}
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            PDF
          </Button>
        </div>
      </div>

      {/* Global summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border border-border/50 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.totalBudgeted}</p>
            <p className="text-lg font-bold amount-display">{fmt(summary.totalBudgeted)}</p>
          </CardContent>
        </Card>
        <Card className="border border-border/50 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.totalConsumed}</p>
            <p className="text-lg font-bold amount-display">{fmt(summary.totalConsumed)}</p>
            <p className="text-[10px] text-muted-foreground">
              {summary.totalBudgeted > 0 ? Math.round((summary.totalConsumed / summary.totalBudgeted) * 100) : 0}%
            </p>
          </CardContent>
        </Card>
        <Card className="border border-border/50 rounded-2xl">
          <CardContent className="p-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-secondary" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.onTrack}</p>
              <p className="text-lg font-bold text-secondary">{summary.onTrackCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border/50 rounded-2xl">
          <CardContent className="p-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.budgetsInAlert}</p>
              <p className="text-lg font-bold text-destructive">{summary.overBudgetCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Savings vs overspend summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border border-border/50 rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingDown className="w-5 h-5 text-secondary" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.totalSavings}</p>
              <p className="text-lg font-bold text-secondary amount-display">{fmt(Math.round(summary.totalSavings))}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border/50 rounded-2xl">
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-destructive" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.totalOverspend}</p>
              <p className="text-lg font-bold text-destructive amount-display">{fmt(Math.round(summary.totalOverspend))}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={`border border-border/50 rounded-2xl ${summary.netVariance >= 0 ? 'ring-1 ring-secondary/30' : 'ring-1 ring-destructive/30'}`}>
          <CardContent className="p-4 flex items-center gap-3">
            {summary.netVariance >= 0 ? <CheckCircle className="w-5 h-5 text-secondary" /> : <AlertTriangle className="w-5 h-5 text-destructive" />}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.netVariance}</p>
              <p className={`text-lg font-bold amount-display ${summary.netVariance >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                {summary.netVariance >= 0 ? '+' : ''}{fmt(Math.round(summary.netVariance))}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart — budget vs actual only */}
      {chartData.length > 0 && (
        <Card className="border border-border/50 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">{t.budgetVsActual}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => abbreviateNumber(v, locale)} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="budget" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name={t.budgetAmount} />
                  <Bar dataKey="actual" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} name={t.spent} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-3 h-1 rounded-full bg-primary" />
                {t.budgetAmount}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-3 h-1 rounded-full bg-destructive" />
                {t.spent}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail cards per budget — simplified */}
      <div className="space-y-3">
        {budgetAnalysis.map(a => {
          const over = a.actual > a.amount;
          return (
            <Card key={a.budget.id} className={`border border-border/50 rounded-2xl glow-primary ${over ? 'ring-1 ring-destructive/20' : ''}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm flex items-center gap-2">
                    <span>{a.budget.categories?.icon || '📁'}</span> {a.budget.name}
                    {a.rawAmount !== a.amount && (
                      <span className="text-[10px] font-normal text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-md">
                        {isFr ? 'normalisé' : 'normalized'}
                      </span>
                    )}
                  </span>
                  <span className={`text-sm font-bold amount-display ${over ? 'text-destructive' : 'text-secondary'}`}>
                    {fmt(a.actual)} / {fmt(a.amount)}
                  </span>
                </div>
                <Progress value={a.pct} className="h-2" />

                <div className="flex items-center justify-between text-[11px] px-1">
                  <span className="text-muted-foreground">{Math.round(a.pct)}% {isFr ? 'consommé' : 'consumed'}</span>
                  <span className={`font-bold ${a.variance >= 0 ? 'text-secondary' : 'text-destructive'}`}>
                    {a.variance >= 0 ? (isFr ? 'Économie' : 'Saving') : (isFr ? 'Dépassement' : 'Overspend')}: {fmt(Math.abs(Math.round(a.variance)))}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default BudgetAnalysisTab;
