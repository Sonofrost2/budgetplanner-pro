import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Download } from 'lucide-react';
import { exportToCSV, exportToExcel } from '@/lib/export';
import { Skeleton } from '@/components/ui/skeleton';

const COLORS = ['#6C63FF', '#2DD4A8', '#F5A623', '#EF4444', '#3B82F6', '#8B5CF6', '#EC4899'];

const ReportsPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const t = dashT[locale];
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fmt = (n: number) => fmtCurrency(n, locale);

  useEffect(() => {
    if (!user) return;
    const now = new Date();
    const twelveAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString().split('T')[0];
    
    Promise.all([
      supabase.from('transactions').select('type, amount, date, description, categories(name)').eq('user_id', user.id).gte('date', twelveAgo).order('date', { ascending: false }),
      supabase.from('transactions').select('amount, categories(name, color)').eq('user_id', user.id).eq('type', 'expense')
        .gte('date', new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0])
        .lte('date', new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]),
    ]).then(([txRes, catRes]) => {
      const data = txRes.data || [];
      setAllTransactions(data);

      const months: any[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { month: 'short' });
        const txs = data.filter(tx => {
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

      const catMap: Record<string, { name: string; value: number; color: string }> = {};
      (catRes.data || []).forEach(tx => {
        const name = (tx.categories as any)?.name || 'Other';
        const color = (tx.categories as any)?.color || '#6C63FF';
        if (!catMap[name]) catMap[name] = { name, value: 0, color };
        catMap[name].value += Number(tx.amount);
      });
      setCategoryData(Object.values(catMap).sort((a, b) => b.value - a.value));
      setLoading(false);
    });
  }, [user, locale]);

  const handleExportCSV = () => {
    const rows = allTransactions.map(tx => ({
      Date: tx.date, Description: tx.description, Type: tx.type,
      Category: (tx.categories as any)?.name || '', Amount: tx.amount,
    }));
    exportToCSV(rows, 'transactions');
  };

  const handleExportExcel = () => {
    const rows = allTransactions.map(tx => ({
      Date: tx.date, Description: tx.description, Type: tx.type,
      Category: (tx.categories as any)?.name || '', Amount: tx.amount,
    }));
    exportToExcel(rows, 'transactions');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2"><Skeleton className="h-9 w-20" /><Skeleton className="h-9 w-20" /></div>
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold font-display">{t.reportTitle}</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <Download className="w-4 h-4 mr-1" /> Excel
          </Button>
        </div>
      </div>

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
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
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
