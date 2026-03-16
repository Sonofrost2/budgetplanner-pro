import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { useAccounts, useAllTransactions } from '@/hooks/useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line } from 'recharts';

const AccountsRecapTab = () => {
  const { locale } = useLanguage();
  const { fmt: fmtCurrency } = useProfile();
  const t = dashT[locale];
  const { data: accounts = [] } = useAccounts();
  const { data: transactions = [] } = useAllTransactions();
  const fmt = (n: number) => fmtCurrency(n, locale);

  const totalBalance = accounts.reduce((s, a) => s + Number(a.real_balance), 0);
  const totalOpening = accounts.reduce((s, a) => s + Number(a.opening_balance), 0);
  const evolution = totalBalance - totalOpening;

  // Monthly balance evolution (last 6 months)
  const monthlyData = useMemo(() => {
    const months: { month: string; balance: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const label = d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', year: '2-digit' });

      let balance = totalOpening;
      for (const tx of transactions) {
        const txDate = new Date(tx.date);
        if (txDate <= endOfMonth) {
          balance += tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount);
        }
      }
      months.push({ month: label, balance });
    }
    return months;
  }, [transactions, totalOpening, locale]);

  // Per-account balances
  const accountData = accounts.map(a => ({
    name: `${a.icon} ${a.name}`,
    balance: Number(a.real_balance),
  }));

  if (accounts.length === 0) {
    return (
      <Card className="border border-border/50 rounded-2xl">
        <CardContent className="py-12 text-center">
          <Wallet className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">{t.noDataYet}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-border/50 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.totalBalance}</p>
            <p className="text-xl font-bold">{fmt(totalBalance)}</p>
          </CardContent>
        </Card>
        <Card className="border border-border/50 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{t.openingBalance}</p>
            <p className="text-xl font-bold">{fmt(totalOpening)}</p>
          </CardContent>
        </Card>
        <Card className="border border-border/50 rounded-2xl">
          <CardContent className="p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{locale === 'fr' ? 'Évolution' : 'Evolution'}</p>
            <p className={`text-xl font-bold flex items-center gap-1 ${evolution >= 0 ? 'text-secondary' : 'text-destructive'}`}>
              {evolution >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {fmt(Math.abs(evolution))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Balance evolution chart */}
      <Card className="border border-border/50 rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            {locale === 'fr' ? 'Évolution des soldes (6 mois)' : 'Balance Evolution (6 months)'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Line type="monotone" dataKey="balance" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} name={t.totalBalance} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Per-account bar chart */}
      {accountData.length > 1 && (
        <Card className="border border-border/50 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">
              {locale === 'fr' ? 'Soldes par compte' : 'Balances by account'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={accountData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="balance" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name={t.realBalance} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AccountsRecapTab;
