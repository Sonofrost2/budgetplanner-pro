import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Wallet, ArrowLeftRight, Plus, Coins } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from 'recharts';
import { AnimatedNumber } from '@/components/ui/animated-number';
import type { Account, Transaction } from '@/hooks/useDashboardData';
import { ACCOUNT_TYPE_COLORS as TYPE_COLORS, CHART_INCOME, CHART_NEGATIVE } from '@/lib/chartColors';


interface Props {
  accounts: Account[];
  transactions: Transaction[];
  fmt: (n: number) => string;
  isFr: boolean;
  onNewAccount: () => void;
  onTransfer: () => void;
  canTransfer: boolean;
}

export const AccountsHeroHeader = ({ accounts, transactions, fmt, isFr, onNewAccount, onTransfer, canTransfer }: Props) => {
  const total = accounts.reduce((s, a) => s + Number(a.real_balance || 0), 0);

  // Sparkline 30j: solde net jour par jour
  const sparkline = useMemo(() => {
    const days = 30;
    const data: { v: number }[] = [];
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const startBase = accounts.reduce((s, a) => s + Number(a.opening_balance || 0), 0);
    const cursor = new Date(today); cursor.setDate(cursor.getDate() - days);
    const accIds = new Set(accounts.map(a => a.id));
    const priorTxs = transactions.filter(t => t.account_id && accIds.has(t.account_id) && new Date(t.date) < cursor);
    let running = startBase + priorTxs.reduce((s, t) => s + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);
    for (let i = 0; i <= days; i++) {
      const day = new Date(cursor); day.setDate(cursor.getDate() + i);
      const dayTxs = transactions.filter(t => {
        if (!t.account_id || !accIds.has(t.account_id)) return false;
        const d = new Date(t.date); d.setHours(0, 0, 0, 0);
        return d.getTime() === day.getTime();
      });
      running += dayTxs.reduce((s, t) => s + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);
      data.push({ v: running });
    }
    return data;
  }, [accounts, transactions]);

  const evolution30d = sparkline.length > 1 ? sparkline[sparkline.length - 1].v - sparkline[0].v : 0;
  const isPositive = evolution30d >= 0;

  // Donut par type
  const byType = useMemo(() => {
    const map: Record<string, number> = {};
    accounts.forEach(a => {
      map[a.type] = (map[a.type] || 0) + Number(a.real_balance || 0);
    });
    return Object.entries(map).map(([type, value]) => ({ type, value: Math.max(0, value) }));
  }, [accounts]);

  return (
    <Card className="relative overflow-hidden border-0 rounded-3xl bg-gradient-to-br from-background via-background to-muted/20">
      {/* Decorative gradient blob */}
      <div className={`absolute -top-20 -right-20 w-72 h-72 rounded-full blur-3xl opacity-30 ${isPositive ? 'bg-secondary' : 'bg-destructive'}`} />
      <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full blur-3xl opacity-20 bg-primary" />

      <div className="relative p-5 sm:p-7">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Total + Sparkline */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
                {isFr ? 'Trésorerie globale' : 'Total Treasury'}
              </span>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-baseline gap-3 flex-wrap"
            >
              <h2 className="text-3xl sm:text-5xl font-bold tracking-tight font-display">
                <AnimatedNumber value={total} format={fmt} duration={0.8} />
              </h2>
              <div className={`flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded-full ${isPositive ? 'bg-secondary/15 text-secondary' : 'bg-destructive/15 text-destructive'}`}>
                {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {isPositive ? '+' : ''}{fmt(evolution30d)}
                <span className="text-[10px] opacity-75 font-normal">/30j</span>
              </div>
            </motion.div>
            <p className="text-xs text-muted-foreground mt-1">
              {(() => {
                const n = accounts.length;
                if (n === 0) return isFr ? '🏦 Ajoutez votre premier compte pour commencer' : '🏦 Add your first account to get started';
                if (isPositive) return isFr
                  ? `📈 ${n} compte${n > 1 ? 's' : ''} actif${n > 1 ? 's' : ''} · trésorerie en hausse sur 30j`
                  : `📈 ${n} active account${n > 1 ? 's' : ''} · treasury up over 30d`;
                return isFr
                  ? `⚠️ ${n} compte${n > 1 ? 's' : ''} actif${n > 1 ? 's' : ''} · trésorerie en baisse — surveillez les sorties`
                  : `⚠️ ${n} active account${n > 1 ? 's' : ''} · treasury down — watch outflows`;
              })()}
            </p>

            {/* Sparkline */}
            <div className="h-14 mt-4 -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sparkline}>
                  <defs>
                    <linearGradient id="wealthSpark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={isPositive ? CHART_INCOME : CHART_NEGATIVE} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={isPositive ? CHART_INCOME : CHART_NEGATIVE} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={isPositive ? CHART_INCOME : CHART_NEGATIVE}
                    strokeWidth={2}
                    fill="url(#wealthSpark)"
                    isAnimationActive
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Donut + Actions */}
          <div className="flex items-center gap-4 lg:gap-6">
            {byType.length > 0 && total > 0 && (
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={byType} dataKey="value" innerRadius="65%" outerRadius="100%" paddingAngle={2} stroke="none">
                      {byType.map((d, i) => (
                        <Cell key={i} fill={TYPE_COLORS[d.type] || 'hsl(var(--muted))'} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <Coins className="w-6 h-6 text-muted-foreground/60" />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                className="rounded-xl text-primary-foreground gap-1.5 shadow-md"
                style={{ background: 'var(--gradient-primary)' }}
                onClick={onNewAccount}
              >
                <Plus className="w-4 h-4" />
                {isFr ? 'Nouveau' : 'New'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl gap-1.5"
                onClick={onTransfer}
                disabled={!canTransfer}
              >
                <ArrowLeftRight className="w-4 h-4" />
                {isFr ? 'Transfert' : 'Transfer'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
