import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

const COLORS = ['#6C63FF', '#2DD4A8', '#F5A623', '#EF4444', '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6'];

interface ChartsSectionProps {
  monthlyData: { name: string; income: number; expenses: number }[];
  categoryData: { name: string; value: number; color: string }[];
  fmt: (n: number) => string;
  t: Record<string, string>;
}

export const ChartsSection = ({ monthlyData, categoryData, fmt, t }: ChartsSectionProps) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <Card className="border-none shadow-[var(--shadow-card)]">
      <CardHeader><CardTitle className="text-base font-semibold">{t.monthlyOverview}</CardTitle></CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="incG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(170, 65%, 45%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(170, 65%, 45%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(250, 70%, 58%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(250, 70%, 58%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(220, 10%, 45%)" />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(220, 10%, 45%)" />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Area type="monotone" dataKey="income" stroke="hsl(170, 65%, 45%)" fill="url(#incG)" strokeWidth={2} name={t.income} />
              <Area type="monotone" dataKey="expenses" stroke="hsl(250, 70%, 58%)" fill="url(#expG)" strokeWidth={2} name={t.expenses} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>

    <Card className="border-none shadow-[var(--shadow-card)]">
      <CardHeader><CardTitle className="text-base font-semibold">{t.expenseByCategory}</CardTitle></CardHeader>
      <CardContent>
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
                  outerRadius={80}
                  innerRadius={40}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ strokeWidth: 1 }}
                >
                  {categoryData.map((entry, i) => (
                    <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  </div>
);
