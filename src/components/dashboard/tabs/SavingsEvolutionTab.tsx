import { useMemo, useState } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { useSavingsGoals } from '@/hooks/useDashboardData';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isLiveGoal } from '@/lib/savingsLogic';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Filter, Search, Inbox, CalendarDays, Target } from 'lucide-react';
import { abbreviateNumber, cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CHART_PALETTE, CHART_TOOLTIP_BG, CHART_GRID } from '@/lib/chartColors';

type PeriodKey = '3m' | '6m' | '1y' | 'all' | 'custom';

const TOOLTIP_STYLE = {
  borderRadius: '12px', border: 'none', background: CHART_TOOLTIP_BG,
  boxShadow: '0 8px 32px rgba(0,0,0,0.12)', fontSize: '12px', padding: '8px 12px',
};

const COLORS = CHART_PALETTE;

const SavingsEvolutionTab = () => {
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const t = dashT[locale];
  const fmt = (n: number) => fmtCurrency(n, locale);
  const isFr = locale === 'fr';

  const { user } = useAuth();
  const { data: allGoals = [] } = useSavingsGoals();
  // E1/E3: only live goals feed the evolution chart to stay consistent with KPI cards.
  const goals = useMemo(() => allGoals.filter(isLiveGoal), [allGoals]);

  const [period, setPeriod] = useState<PeriodKey>('1y');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [selectedGoalIds, setSelectedGoalIds] = useState<Set<string>>(new Set());
  const [goalSearch, setGoalSearch] = useState('');

  const periodLabels: Record<PeriodKey, string> = {
    '3m': isFr ? '3 mois' : '3 months', '6m': isFr ? '6 mois' : '6 months',
    '1y': isFr ? '1 an' : '1 year', all: isFr ? 'Tout' : 'All', custom: isFr ? 'Personnalisé' : 'Custom',
  };

  const searchedGoals = useMemo(() => {
    if (!goalSearch.trim()) return goals;
    const q = goalSearch.toLowerCase();
    return goals.filter(g => g.name.toLowerCase().includes(q));
  }, [goals, goalSearch]);

  const effectiveIds = useMemo(() => {
    const all = new Set(goals.map(g => g.id));
    if (selectedGoalIds.size === 0) return all;
    const valid = new Set<string>();
    selectedGoalIds.forEach(id => { if (all.has(id)) valid.add(id); });
    return valid.size > 0 ? valid : all;
  }, [selectedGoalIds, goals]);

  const toggleGoal = (id: string) => {
    setSelectedGoalIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Compute window + monthly buckets
  const window = useMemo(() => {
    const now = new Date();
    let startDate: Date;
    if (period === 'custom' && customFrom) {
      startDate = new Date(customFrom.getFullYear(), customFrom.getMonth(), 1);
    } else {
      switch (period) {
        case '3m': startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1); break;
        case '6m': startDate = new Date(now.getFullYear(), now.getMonth() - 6, 1); break;
        case '1y': startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1); break;
        default: startDate = new Date(2020, 0, 1);
      }
    }
    const endDate = (period === 'custom' && customTo)
      ? new Date(customTo.getFullYear(), customTo.getMonth() + 1, 0)
      : now;
    const months: { label: string; start: Date; end: Date }[] = [];
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (cursor <= endDate) {
      const mEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      months.push({
        label: cursor.toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { month: 'short', year: '2-digit' }),
        start: new Date(cursor),
        end: mEnd,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return { startDate, endDate, months };
  }, [period, customFrom, customTo, isFr]);

  const activeGoals = useMemo(
    () => goals.filter(g => effectiveIds.has(g.id)),
    [goals, effectiveIds],
  );

  // E3: fetch monthly contributions per goal via `get_savings_contribution` RPC.
  // This uses the same source of truth as the Budget module (incoming transfers
  // to the goal), so transfers/expenses on the account never distort the curve.
  const goalIdsKey = activeGoals.map(g => g.id).join(',');
  const windowKey = `${window.startDate.toISOString()}|${window.endDate.toISOString()}`;
  const { data: contribByGoalMonth = {}, isLoading: contribLoading } = useQuery({
    queryKey: ['savings-evolution-contrib', user?.id, goalIdsKey, windowKey],
    enabled: !!user && activeGoals.length > 0 && window.months.length > 0,
    staleTime: 30_000,
    queryFn: async () => {
      const toISO = (d: Date) => d.toISOString().slice(0, 10);
      const out: Record<string, number[]> = {};
      await Promise.all(activeGoals.map(async (g) => {
        const monthly = await Promise.all(window.months.map(async (m) => {
          const { data, error } = await (supabase.rpc as any)('get_savings_contribution', {
            p_user_id: user!.id,
            p_goal_id: g.id,
            p_start_date: toISO(m.start),
            p_end_date: toISO(m.end),
          });
          if (error || data == null) return 0;
          return Number(data) || 0;
        }));
        out[g.id] = monthly;
      }));
      return out;
    },
  });

  // Build chart data: cumulative baseline anchored so the final month equals
  // `current_amount`. baseline = current_amount - sum(contribs in window).
  const chartData = useMemo(() => {
    if (activeGoals.length === 0 || window.months.length === 0) return [];
    return window.months.map((m, idx) => {
      const row: Record<string, any> = { name: m.label };
      activeGoals.forEach(g => {
        const monthly = contribByGoalMonth[g.id] ?? [];
        const total = monthly.reduce((s, v) => s + v, 0);
        const current = Number(g.current_amount || 0);
        const baseline = current - total;
        let cumul = baseline;
        for (let i = 0; i <= idx; i++) cumul += monthly[i] ?? 0;
        row[g.id] = Math.max(0, cumul);
        row[`target_${g.id}`] = Number(g.target_amount);
      });
      return row;
    });
  }, [activeGoals, window.months, contribByGoalMonth]);

  const hasData = activeGoals.length > 0 && chartData.length > 0 && !contribLoading;
  const selectedCount = selectedGoalIds.size;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="border border-border/50 rounded-2xl">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onValueChange={v => setPeriod(v as PeriodKey)}>
              <SelectTrigger className="h-9 w-36 rounded-xl text-xs font-medium"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(periodLabels).map(([k, label]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
              </SelectContent>
            </Select>

            {period === 'custom' && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("h-9 rounded-xl text-xs gap-1.5 min-w-[120px]", !customFrom && "text-muted-foreground")}>
                      <CalendarDays className="w-3.5 h-3.5" />
                      {customFrom ? format(customFrom, 'dd MMM yyyy', { locale: isFr ? fr : undefined }) : (isFr ? 'Du...' : 'From...')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} initialFocus className={cn("p-3 pointer-events-auto")} locale={isFr ? fr : undefined} />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("h-9 rounded-xl text-xs gap-1.5 min-w-[120px]", !customTo && "text-muted-foreground")}>
                      <CalendarDays className="w-3.5 h-3.5" />
                      {customTo ? format(customTo, 'dd MMM yyyy', { locale: isFr ? fr : undefined }) : (isFr ? 'Au...' : 'To...')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customTo} onSelect={setCustomTo} disabled={d => customFrom ? d < customFrom : false} initialFocus className={cn("p-3 pointer-events-auto")} locale={isFr ? fr : undefined} />
                  </PopoverContent>
                </Popover>
              </>
            )}

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 rounded-xl text-xs gap-1.5">
                  <Filter className="w-3.5 h-3.5" />
                  {isFr ? 'Objectifs' : 'Goals'}
                  {selectedCount > 0 && <span className="ml-1 bg-primary/20 text-primary rounded-full px-1.5 py-0.5 text-[10px] font-bold">{selectedCount}</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="end">
                <div className="p-2 border-b border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">{isFr ? 'Filtrer les objectifs' : 'Filter goals'}</span>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => setSelectedGoalIds(new Set())}>{isFr ? 'Tout' : 'All'}</Button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input value={goalSearch} onChange={e => setGoalSearch(e.target.value)} placeholder={isFr ? 'Rechercher...' : 'Search...'} className="h-8 pl-8 text-xs rounded-lg" />
                  </div>
                </div>
                <ScrollArea className="max-h-64">
                  <div className="p-2 space-y-0.5">
                    {searchedGoals.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">{isFr ? 'Aucun résultat' : 'No results'}</p>
                    ) : searchedGoals.map(g => (
                      <label key={g.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                        <Checkbox checked={effectiveIds.has(g.id)} onCheckedChange={() => toggleGoal(g.id)} />
                        <span className="text-sm">{g.icon}</span>
                        <span className="text-xs truncate flex-1">{g.name}</span>
                        <span className="text-[10px] text-muted-foreground">{Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100)}%</span>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Stats summary */}
      {activeGoals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border border-border/50 rounded-2xl">
            <CardContent className="p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{isFr ? 'Total épargné' : 'Total Saved'}</p>
              <p className="text-xl font-bold text-secondary">{fmt(activeGoals.reduce((s, g) => s + Number(g.current_amount), 0))}</p>
            </CardContent>
          </Card>
          <Card className="border border-border/50 rounded-2xl">
            <CardContent className="p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{isFr ? 'Total objectif' : 'Total Target'}</p>
              <p className="text-xl font-bold">{fmt(activeGoals.reduce((s, g) => s + Number(g.target_amount), 0))}</p>
            </CardContent>
          </Card>
          <Card className="border border-border/50 rounded-2xl">
            <CardContent className="p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{isFr ? 'Progression' : 'Progress'}</p>
              {(() => {
                const totalCurrent = activeGoals.reduce((s, g) => s + Number(g.current_amount), 0);
                const totalTarget = activeGoals.reduce((s, g) => s + Number(g.target_amount), 0);
                const pct = totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0;
                return <p className="text-xl font-bold flex items-center gap-1 text-primary"><Target className="w-4 h-4" />{pct}%</p>;
              })()}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart */}
      <Card className="border border-border/50 shadow-[var(--shadow-card)] rounded-2xl">
        <CardContent className="p-4 sm:p-6">
          {!hasData ? (
            <div className="h-96 flex items-center justify-center">
              <div className="text-center">
                <Inbox className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">{isFr ? 'Aucun objectif d\'épargne' : 'No savings goals'}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{isFr ? 'Créez des objectifs pour voir leur évolution' : 'Create goals to see their evolution'}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="h-[420px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      {activeGoals.map((g, i) => (
                        <linearGradient key={g.id} id={`sav-${g.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} opacity={0.4} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => abbreviateNumber(v, locale)} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(v: number, name: string) => {
                        const isTarget = name.startsWith('target_');
                        const gId = name.replace('target_', '');
                        const g = activeGoals.find(goal => goal.id === (isTarget ? gId : name));
                        const label = g ? `${g.icon} ${g.name}` : name;
                        return [fmt(v), isTarget ? `${label} (${isFr ? 'Objectif' : 'Target'})` : label];
                      }}
                      labelStyle={{ fontWeight: 600, fontSize: 12 }}
                    />
                    {activeGoals.map((g, i) => (
                      <Area key={g.id} type="monotone" dataKey={g.id} stroke={COLORS[i % COLORS.length]} fill={`url(#sav-${g.id})`} strokeWidth={2.5} name={g.id} animationDuration={800} />
                    ))}
                    {activeGoals.map((g, i) => (
                      <Area key={`target_${g.id}`} type="monotone" dataKey={`target_${g.id}`} stroke={COLORS[i % COLORS.length]} fill="none" strokeWidth={1} strokeDasharray="5 5" name={`target_${g.id}`} animationDuration={800} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-4 pt-4 border-t border-border/50">
                {activeGoals.map((g, i) => (
                  <div key={g.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-3 h-1.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span>{g.icon} {g.name}</span>
                    <span className="text-[10px] font-semibold text-primary">{Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SavingsEvolutionTab;
