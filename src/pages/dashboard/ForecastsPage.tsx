import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const ForecastsPage = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const t = dashT[locale];
  const [forecastData, setForecastData] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    // Get last 6 months of data to project next 6
    const now = new Date();
    const sixAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0];
    
    supabase.from('transactions').select('type, amount, date')
      .eq('user_id', user.id).gte('date', sixAgo)
      .then(({ data }) => {
        const monthlyIncome: number[] = [];
        const monthlyExpense: number[] = [];
        
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const txs = (data || []).filter(tx => {
            const td = new Date(tx.date);
            return td.getMonth() === d.getMonth() && td.getFullYear() === d.getFullYear();
          });
          monthlyIncome.push(txs.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0));
          monthlyExpense.push(txs.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0));
        }

        const avgIncome = monthlyIncome.reduce((a, b) => a + b, 0) / Math.max(monthlyIncome.filter(v => v > 0).length, 1);
        const avgExpense = monthlyExpense.reduce((a, b) => a + b, 0) / Math.max(monthlyExpense.filter(v => v > 0).length, 1);
        
        const months = locale === 'fr' 
          ? ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
          : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        const result: any[] = [];
        // Past 6 months
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          result.push({
            name: months[d.getMonth()],
            income: monthlyIncome[5 - i],
            expenses: monthlyExpense[5 - i],
            type: 'actual',
          });
        }
        // Next 6 months forecast
        for (let i = 1; i <= 6; i++) {
          const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
          result.push({
            name: months[d.getMonth()],
            optimisticIncome: avgIncome * 1.1,
            realisticIncome: avgIncome,
            pessimisticIncome: avgIncome * 0.85,
            optimisticExpenses: avgExpense * 0.9,
            realisticExpenses: avgExpense,
            pessimisticExpenses: avgExpense * 1.15,
            type: 'forecast',
          });
        }
        setForecastData(result);
      });
  }, [user, locale]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-display">{t.forecastTitle}</h2>
        <p className="text-muted-foreground mt-1">{t.forecastSubtitle}</p>
      </div>

      <Tabs defaultValue="realistic">
        <TabsList>
          <TabsTrigger value="optimistic">{t.optimistic}</TabsTrigger>
          <TabsTrigger value="realistic">{t.realistic}</TabsTrigger>
          <TabsTrigger value="pessimistic">{t.pessimistic}</TabsTrigger>
        </TabsList>

        {['optimistic', 'realistic', 'pessimistic'].map(scenario => (
          <TabsContent key={scenario} value={scenario}>
            <Card className="border-none shadow-[var(--shadow-card)]">
              <CardHeader>
                <CardTitle className="text-base">{t.incomeVsExpenses} — {t[scenario as keyof typeof t]}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={forecastData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      {/* Actual data */}
                      <Line type="monotone" dataKey="income" stroke="hsl(170, 65%, 45%)" strokeWidth={2} name={t.income} connectNulls={false} />
                      <Line type="monotone" dataKey="expenses" stroke="hsl(250, 70%, 58%)" strokeWidth={2} name={t.expenses} connectNulls={false} />
                      {/* Forecast */}
                      <Line type="monotone" dataKey={`${scenario}Income`} stroke="hsl(170, 65%, 45%)" strokeWidth={2} strokeDasharray="5 5" name={`${t.income} (${t.projected})`} connectNulls={false} />
                      <Line type="monotone" dataKey={`${scenario}Expenses`} stroke="hsl(250, 70%, 58%)" strokeWidth={2} strokeDasharray="5 5" name={`${t.expenses} (${t.projected})`} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default ForecastsPage;
