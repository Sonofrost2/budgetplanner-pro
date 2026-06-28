import type { DashTranslations } from '@/i18n/dashTranslations';
import { BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { abbreviateNumber, groupTopN } from '@/lib/utils';
import { useMemo } from 'react';
import { CHART_INCOME, CHART_EXPENSE, CHART_GRID, CHART_AXIS } from '@/lib/chartColors';

interface ChartsSectionProps {
  monthlyData: { name: string; income: number; expenses: number }[];
  categoryData: { name: string; value: number; color: string }[];
  fmt: (n: number) => string;
  t: DashTranslations;
  locale?: string;
}

const TOOLTIP_STYLE = {
  borderRadius: '12px',
  border: 'none',
  background: 'hsl(var(--card))',
  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
  fontSize: '12px',
  padding: '8px 12px',
};

const CustomTooltip = ({ active, payload, label, fmt }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <p className="font-semibold text-foreground text-xs mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold text-foreground">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

const PieLegend = ({ data, fmt, total }: { data: { name: string; value: number; color: string }[]; fmt: (n: number) => string; total: number }) => (
  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2 px-1">
    {data.map((d, i) => {
      const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0';
      return (
        <div key={i} className="flex items-center gap-2 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
          <span className="text-xs text-muted-foreground truncate">{d.name}</span>
          <span className="text-xs font-semibold ml-auto shrink-0">{pct}%</span>
        </div>
      );
    })}
  </div>
);

export const ChartsSection = ({ monthlyData, categoryData, fmt, t, locale = 'fr' }: ChartsSectionProps) => {
  const groupedData = useMemo(() => groupTopN(categoryData, 5, locale), [categoryData, locale]);
  const totalExpenses = groupedData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Area Chart */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="glass rounded-2xl overflow-hidden"
      >
        <div className="p-4 pb-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5 text-primary" />
            </div>
            {t.monthlyOverview}
          </h3>
        </div>
        <div className="px-4 pb-4">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="incG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_INCOME} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={CHART_INCOME} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_EXPENSE} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={CHART_EXPENSE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} opacity={0.4} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke={CHART_AXIS} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} stroke={CHART_AXIS} axisLine={false} tickLine={false} tickFormatter={(v) => abbreviateNumber(v, locale)} />
                <Tooltip content={<CustomTooltip fmt={fmt} />} />
                <Area type="monotone" dataKey="income" stroke={CHART_INCOME} fill="url(#incG)" strokeWidth={2} name={t.income} animationDuration={1200} />
                <Area type="monotone" dataKey="expenses" stroke={CHART_EXPENSE} fill="url(#expG)" strokeWidth={2} name={t.expenses} animationDuration={1200} animationBegin={200} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-6 mt-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-3 h-1 rounded-full" style={{ background: CHART_INCOME }} />
              {t.income}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-3 h-1 rounded-full" style={{ background: CHART_EXPENSE }} />
              {t.expenses}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Pie Chart */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="glass rounded-2xl overflow-hidden"
      >
        <div className="p-4 pb-3">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
              <PieChartIcon className="w-3.5 h-3.5 text-accent" />
            </div>
            {t.expenseByCategory}
          </h3>
        </div>
        <div className="px-4 pb-4">
          {groupedData.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-56 flex items-center justify-center">
              <p className="text-xs text-muted-foreground">{t.noTransactions}</p>
            </motion.div>
          ) : (
            <>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={groupedData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      innerRadius={40}
                      strokeWidth={2}
                      stroke="hsl(var(--card))"
                      animationDuration={1000}
                      animationBegin={300}
                      animationEasing="ease-out"
                    >
                      {groupedData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number, name: string) => [fmt(v), name]}
                      contentStyle={TOOLTIP_STYLE}
                      animationDuration={200}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <PieLegend data={groupedData} fmt={fmt} total={totalExpenses} />
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};
