import type { DashTranslations } from '@/i18n/dashTranslations';
import { BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

interface ChartsSectionProps {
  monthlyData: { name: string; income: number; expenses: number }[];
  categoryData: { name: string; value: number; color: string }[];
  fmt: (n: number) => string;
  t: DashTranslations;
}

export const ChartsSection = ({ monthlyData, categoryData, fmt, t }: ChartsSectionProps) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <div className="glass rounded-2xl overflow-hidden">
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
                  <stop offset="5%" stopColor="hsl(165, 70%, 46%)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(165, 70%, 46%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(250, 85%, 60%)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(250, 85%, 60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(225, 15%, 88%)" vertical={false} opacity={0.4} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(225, 10%, 45%)" axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(225, 10%, 45%)" axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number) => fmt(v)}
                contentStyle={{ borderRadius: '12px', border: 'none', background: 'hsl(var(--glass))', backdropFilter: 'blur(12px)', boxShadow: 'var(--shadow-glass)', fontSize: '11px' }}
              />
              <Area type="monotone" dataKey="income" stroke="hsl(165, 70%, 46%)" fill="url(#incG)" strokeWidth={2} name={t.income} />
              <Area type="monotone" dataKey="expenses" stroke="hsl(250, 85%, 60%)" fill="url(#expG)" strokeWidth={2} name={t.expenses} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>

    <div className="glass rounded-2xl overflow-hidden">
      <div className="p-4 pb-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
            <PieChartIcon className="w-3.5 h-3.5 text-accent" />
          </div>
          {t.expenseByCategory}
        </h3>
      </div>
      <div className="px-4 pb-4">
        {categoryData.length === 0 ? (
          <div className="h-56 flex items-center justify-center">
            <p className="text-xs text-muted-foreground">{t.noTransactions}</p>
          </div>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  innerRadius={45}
                  strokeWidth={2}
                  stroke="transparent"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ strokeWidth: 1, stroke: 'hsl(var(--muted-foreground))' }}
                >
                  {categoryData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => fmt(v)}
                  contentStyle={{ borderRadius: '12px', border: 'none', background: 'hsl(var(--glass))', backdropFilter: 'blur(12px)', boxShadow: 'var(--shadow-glass)', fontSize: '11px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  </div>
);
