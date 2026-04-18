import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { ResponsiveContainer, LineChart, Line } from 'recharts';
import { AlertTriangle, MoreHorizontal, Pencil, Trash2, Archive, Eye, Coins, History, Wallet, CheckCircle2, Moon } from 'lucide-react';
import type { Account, Transaction } from '@/hooks/useDashboardData';

interface Props {
  account: Account;
  transactions: Transaction[];
  theoreticalBalance: number;
  fmt: (n: number) => string;
  isFr: boolean;
  selected: boolean;
  onSelect: () => void;
  onUpdateBalance: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCashCount: () => void;
  onViewHistory: () => void;
  onDrilldown: () => void;
  onArchive: () => void;
}

const TYPE_LABELS: Record<string, { fr: string; en: string }> = {
  bank: { fr: 'Banque', en: 'Bank' },
  mobile_money: { fr: 'Mobile Money', en: 'Mobile Money' },
  cash: { fr: 'Espèces', en: 'Cash' },
  card: { fr: 'Carte', en: 'Card' },
  savings: { fr: 'Épargne', en: 'Savings' },
};

const TYPE_COLORS: Record<string, string> = {
  bank: 'from-blue-500/10 to-blue-600/5',
  mobile_money: 'from-orange-500/10 to-orange-600/5',
  cash: 'from-emerald-500/10 to-emerald-600/5',
  card: 'from-purple-500/10 to-purple-600/5',
  savings: 'from-pink-500/10 to-pink-600/5',
};

export const AccountCardPremium = ({
  account, transactions, theoreticalBalance, fmt, isFr,
  selected, onSelect, onUpdateBalance, onEdit, onDelete, onCashCount, onViewHistory, onDrilldown, onArchive,
}: Props) => {
  const real = Number(account.real_balance || 0);
  const discrepancy = real - theoreticalBalance;
  const hasDiscrepancy = Math.abs(discrepancy) > 0.01;
  const isCash = account.type === 'cash';
  const isArchived = !!account.archived_at;
  const isDormant = (account as any).status === 'dormant';

  // Sparkline 30j
  const sparkline = useMemo(() => {
    const days = 30;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const cursor = new Date(today); cursor.setDate(cursor.getDate() - days);
    const accTxs = transactions.filter(t => t.account_id === account.id);
    const priorTxs = accTxs.filter(t => new Date(t.date) < cursor);
    let running = Number(account.opening_balance || 0) +
      priorTxs.reduce((s, t) => s + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);
    const data: { v: number }[] = [];
    for (let i = 0; i <= days; i++) {
      const d = new Date(cursor); d.setDate(cursor.getDate() + i);
      const dayTxs = accTxs.filter(t => {
        const td = new Date(t.date); td.setHours(0, 0, 0, 0);
        return td.getTime() === d.getTime();
      });
      running += dayTxs.reduce((s, t) => s + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);
      data.push({ v: running });
    }
    return data;
  }, [transactions, account.id, account.opening_balance]);

  const trend = sparkline.length > 1 ? sparkline[sparkline.length - 1].v - sparkline[0].v : 0;
  const isUp = trend >= 0;
  const typeLabel = TYPE_LABELS[account.type]?.[isFr ? 'fr' : 'en'] || account.type;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`relative overflow-hidden border border-border/50 rounded-2xl bg-gradient-to-br ${TYPE_COLORS[account.type] || 'from-muted/30 to-muted/10'} hover:shadow-[var(--shadow-elevated)] transition-all duration-300 group ${selected ? 'ring-2 ring-primary' : ''} ${isArchived ? 'opacity-60' : ''}`}>
        {/* Selection checkbox */}
        <div className="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <Checkbox checked={selected} onCheckedChange={onSelect} className="bg-background/80 backdrop-blur" />
        </div>

        {/* Top action menu */}
        <div className="absolute top-3 right-3 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg bg-background/60 backdrop-blur hover:bg-background">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={onDrilldown}><Eye className="w-3.5 h-3.5 mr-2" />{isFr ? 'Statistiques' : 'Statistics'}</DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}><Pencil className="w-3.5 h-3.5 mr-2" />{isFr ? 'Modifier' : 'Edit'}</DropdownMenuItem>
              {isCash && (
                <DropdownMenuItem onClick={onCashCount}><Coins className="w-3.5 h-3.5 mr-2" />{isFr ? 'PV espèces' : 'Cash count'}</DropdownMenuItem>
              )}
              {isCash && (
                <DropdownMenuItem onClick={onViewHistory}><History className="w-3.5 h-3.5 mr-2" />{isFr ? 'Historique PV' : 'PV history'}</DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onArchive}>
                <Archive className="w-3.5 h-3.5 mr-2" />
                {isArchived ? (isFr ? 'Désarchiver' : 'Unarchive') : (isFr ? 'Archiver' : 'Archive')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="w-3.5 h-3.5 mr-2" />{isFr ? 'Supprimer' : 'Delete'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="p-5 pt-12">
          {/* Header */}
          <div className="flex items-start gap-3 mb-4">
            <div className="text-3xl shrink-0">{account.icon}</div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-base truncate">{account.name}</h3>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <Badge variant="secondary" className="text-[10px] h-5 rounded-md font-medium">{typeLabel}</Badge>
                {isArchived && <Badge variant="outline" className="text-[10px] h-5 rounded-md gap-1"><Archive className="w-2.5 h-2.5" />{isFr ? 'Archivé' : 'Archived'}</Badge>}
                {isDormant && !isArchived && <Badge variant="outline" className="text-[10px] h-5 rounded-md gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400"><Moon className="w-2.5 h-2.5" />{isFr ? 'Dormant' : 'Dormant'}</Badge>}
                {!hasDiscrepancy && !isArchived && (
                  <Badge variant="outline" className="text-[10px] h-5 rounded-md gap-1 border-secondary/40 text-secondary">
                    <CheckCircle2 className="w-2.5 h-2.5" />{isFr ? 'Équilibré' : 'Balanced'}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Balances */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                {isFr ? 'Solde réel' : 'Real'}
              </p>
              <p className="text-lg font-bold tabular-nums">{fmt(real)}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
                {isFr ? 'Théorique' : 'Theoretical'}
              </p>
              <p className="text-lg font-semibold text-muted-foreground tabular-nums">{fmt(theoreticalBalance)}</p>
            </div>
          </div>

          {/* Sparkline */}
          <div className="h-10 -mx-1 mb-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkline}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={isUp ? 'hsl(165, 70%, 46%)' : 'hsl(0, 84%, 60%)'}
                  strokeWidth={1.8}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Discrepancy alert + CTA */}
          {hasDiscrepancy && !isArchived && (
            <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-2.5 mb-3">
              <div className="flex items-center gap-2 mb-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
                <span className="text-xs font-semibold text-destructive">
                  {isFr ? 'Écart' : 'Gap'}: {discrepancy > 0 ? '+' : ''}{fmt(discrepancy)}
                </span>
              </div>
              <Button
                size="sm"
                className="w-full h-7 rounded-lg text-xs text-primary-foreground"
                style={{ background: 'var(--gradient-primary)' }}
                onClick={onUpdateBalance}
              >
                <Wallet className="w-3 h-3 mr-1" />
                {isFr ? 'Réconcilier' : 'Reconcile'}
              </Button>
            </div>
          )}

          {!hasDiscrepancy && !isArchived && (
            <Button
              size="sm"
              variant="outline"
              className="w-full h-7 rounded-lg text-xs"
              onClick={onUpdateBalance}
            >
              <Wallet className="w-3 h-3 mr-1" />
              {isFr ? 'Mettre à jour solde réel' : 'Update real balance'}
            </Button>
          )}
        </div>
      </Card>
    </motion.div>
  );
};
