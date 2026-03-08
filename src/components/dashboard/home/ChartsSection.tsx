import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

interface ChartsSectionProps {
  monthlyData: { name: string; income: number; expenses: number }[];
  categoryData: { name: string; value: number; color: string }[];
  fmt: (n: number) => string;
  t: Record<string, string>;
}

export const ChartsSection = ({ monthlyData, categoryData, fmt, t }: ChartsSectionProps) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <Card className="border border-border/50 shadow-[var(--shadow-card)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <BarChart3 className="w-3.5 h-3.5 text-primary" />
          </div>
          {t.monthlyOverview}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="incG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(170, 65%, 45%)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(170, 65%, 45%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(250, 70%, 58%)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(250, 70%, 58%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(220, 10%, 45%)" axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(220, 10%, 45%)" axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number) => fmt(v)}
                contentStyle={{ borderRadius: '12px', border: '1px solid hsl(220, 15%, 90%)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              />
              <Area type="monotone" dataKey="income" stroke="hsl(170, 65%, 45%)" fill="url(#incG)" strokeWidth={2.5} name={t.income} />
              <Area type="monotone" dataKey="expenses" stroke="hsl(250, 70%, 58%)" fill="url(#expG)" strokeWidth={2.5} name={t.expenses} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>

    <Card className="border border-border/50 shadow-[var(--shadow-card)]">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
            <PieChartIcon className="w-3.5 h-3.5 text-accent" />
          </div>
          {t.expenseByCategory}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {categoryData.length === 0 ? (
          <div className="h-64 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">{t.noTransactions}</p>
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  innerRadius={50}
                  strokeWidth={2}
                  stroke="hsl(var(--card))"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ strokeWidth: 1 }}
                >
                  {categoryData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => fmt(v)}
                  contentStyle={{ borderRadius: '12px', border: '1px solid hsl(220, 15%, 90%)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  </div>
);
