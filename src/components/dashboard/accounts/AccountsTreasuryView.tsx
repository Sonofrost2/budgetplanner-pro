import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Smartphone, Coins, CreditCard, PiggyBank, ChevronRight } from 'lucide-react';
import type { Account, Transaction } from '@/hooks/useDashboardData';
import { AccountCardPremium } from './AccountCardPremium';

const TYPE_META: Record<string, { fr: string; en: string; icon: any; color: string }> = {
  bank: { fr: 'Banques', en: 'Banks', icon: Building2, color: 'text-blue-500' },
  mobile_money: { fr: 'Mobile Money', en: 'Mobile Money', icon: Smartphone, color: 'text-orange-500' },
  cash: { fr: 'Espèces', en: 'Cash', icon: Coins, color: 'text-emerald-500' },
  card: { fr: 'Cartes', en: 'Cards', icon: CreditCard, color: 'text-purple-500' },
  savings: { fr: 'Épargne', en: 'Savings', icon: PiggyBank, color: 'text-pink-500' },
};

interface Props {
  accounts: Account[];
  transactions: Transaction[];
  theoreticalBalances: Record<string, number>;
  fmt: (n: number) => string;
  isFr: boolean;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onUpdateBalance: (a: Account) => void;
  onEdit: (a: Account) => void;
  onDelete: (id: string) => void;
  onCashCount: (a: Account) => void;
  onViewHistory: (id: string) => void;
  onDrilldown: (a: Account) => void;
  onArchive: (a: Account) => void;
}

export const AccountsTreasuryView = (props: Props) => {
  const grouped = useMemo(() => {
    const map: Record<string, Account[]> = {};
    props.accounts.forEach(a => {
      if (!map[a.type]) map[a.type] = [];
      map[a.type].push(a);
    });
    return map;
  }, [props.accounts]);

  const types = Object.keys(grouped).sort((a, b) => {
    const ord = ['bank', 'mobile_money', 'cash', 'card', 'savings'];
    return ord.indexOf(a) - ord.indexOf(b);
  });

  return (
    <div className="space-y-6">
      {types.map(type => {
        const meta = TYPE_META[type] || { fr: type, en: type, icon: Building2, color: 'text-muted-foreground' };
        const Icon = meta.icon;
        const accs = grouped[type];
        const subtotal = accs.reduce((s, a) => s + Number(a.real_balance || 0), 0);
        return (
          <div key={type}>
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 ${meta.color}`} />
                <h3 className="font-bold text-sm uppercase tracking-wider">{meta[props.isFr ? 'fr' : 'en']}</h3>
                <Badge variant="secondary" className="text-[10px] h-5 rounded-md">{accs.length}</Badge>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">{props.isFr ? 'Sous-total' : 'Subtotal'}</p>
                <p className="text-sm font-bold tabular-nums">{props.fmt(subtotal)}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {accs.map(acc => (
                <AccountCardPremium
                  key={acc.id}
                  account={acc}
                  transactions={props.transactions}
                  theoreticalBalance={props.theoreticalBalances[acc.id] ?? Number(acc.opening_balance || 0)}
                  fmt={props.fmt}
                  isFr={props.isFr}
                  selected={props.selectedIds.has(acc.id)}
                  onSelect={() => props.onToggle(acc.id)}
                  onUpdateBalance={() => props.onUpdateBalance(acc)}
                  onEdit={() => props.onEdit(acc)}
                  onDelete={() => props.onDelete(acc.id)}
                  onCashCount={() => props.onCashCount(acc)}
                  onViewHistory={() => props.onViewHistory(acc.id)}
                  onDrilldown={() => props.onDrilldown(acc)}
                  onArchive={() => props.onArchive(acc)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
