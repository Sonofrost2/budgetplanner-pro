import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#6C63FF', '#2DD4A8', '#F5A623', '#EF4444', '#3B82F6', '#8B5CF6', '#EC4899'];

const ReportsPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const t = dashT[locale];
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);

  const fmt = (n: number) => n.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US', { style: 'currency', currency: 'EUR' });

  useEffect(() => {
    if (!user) return;
    const now = new Date();

    // Last 12 months data
    const twelveAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().split('T')[0];
    supabase.from('transactions').select('type, amount, date').eq('user_id', user.id).gte('date', twelveAgo)
      .then(({ data }) => {
        const months: any[] = [];
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const label = d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' });
          const txs = (data || []).filter(tx => {
            const td = new Date(tx.date);
            return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
          });
          months.push({
            name: label,
            income: txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0),
            expenses: txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0),
          });
        }
        setMonthlyData(months);
      });

    // Category breakdown for current month
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    supabase.from('transactions').select('amount, categories(name, color)').eq('user_id', user.id)
      .eq('type', 'expense').gte('date', start).lte('date', end)
      .then(({ data }) => {
        const catMap: Record<string, { name: string; value: number; color: string }> = {};
        (data || []).forEach(tx => {
          const name = (tx.categories as any)?.name || 'Other';
          const color = (tx.categories as any)?.color || '#6C63FF';
          if (!catMap[name]) catMap[name] = { name, value: 0, color };
          catMap[name].value += Number(tx.amount);
        });
        setCategoryData(Object.values(catMap).sort((a, b) => b.value - a.value));
      });
  }, [user, locale]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold font-display">{t.reportTitle}</h2>

      <Tabs defaultValue="monthly">
        <TabsList>
          <TabsTrigger value="monthly">{t.monthlyReport}</TabsTrigger>
          <TabsTrigger value="categories">{t.topExpenses}</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly">
          <Card className="border-none shadow-[var(--shadow-card)]">
            <CardHeader><CardTitle className="text-base">{t.incomeVsExpenses}</CardTitle></CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Bar dataKey="income" fill="hsl(170, 65%, 45%)" name={t.income} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" fill="hsl(250, 70%, 58%)" name={t.expenses} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card className="border-none shadow-[var(--shadow-card)]">
            <CardHeader><CardTitle className="text-base">{t.topExpenses}</CardTitle></CardHeader>
            <CardContent>
              {categoryData.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t.noTransactions}</p>
              ) : (
                <div className="flex flex-col lg:flex-row items-center gap-8">
                  <div className="h-64 w-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {categoryData.map((entry, i) => (
                            <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmt(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2">
                    {categoryData.map((c, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ background: c.color || COLORS[i % COLORS.length] }} />
                          <span className="text-sm">{c.name}</span>
                        </div>
                        <span className="text-sm font-semibold">{fmt(c.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReportsPage;
