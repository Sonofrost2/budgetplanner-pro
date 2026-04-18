import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Pencil, Trash2, Eye, Wallet, Archive } from 'lucide-react';
import type { Account } from '@/hooks/useDashboardData';

interface Props {
  accounts: Account[];
  theoreticalBalances: Record<string, number>;
  fmt: (n: number) => string;
  isFr: boolean;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onDrilldown: (a: Account) => void;
  onEdit: (a: Account) => void;
  onDelete: (id: string) => void;
  onUpdateBalance: (a: Account) => void;
}

const TYPE_LABELS: Record<string, { fr: string; en: string }> = {
  bank: { fr: 'Banque', en: 'Bank' },
  mobile_money: { fr: 'Mobile Money', en: 'Mobile Money' },
  cash: { fr: 'Espèces', en: 'Cash' },
  card: { fr: 'Carte', en: 'Card' },
  savings: { fr: 'Épargne', en: 'Savings' },
};

export const AccountsListView = ({
  accounts, theoreticalBalances, fmt, isFr,
  selectedIds, onToggle, onToggleAll,
  onDrilldown, onEdit, onDelete, onUpdateBalance,
}: Props) => {
  const allSelected = accounts.length > 0 && selectedIds.size === accounts.length;
  return (
    <Card className="border border-border/50 rounded-2xl overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="w-10">
              <Checkbox checked={allSelected} onCheckedChange={onToggleAll} />
            </TableHead>
            <TableHead>{isFr ? 'Compte' : 'Account'}</TableHead>
            <TableHead className="hidden sm:table-cell">{isFr ? 'Type' : 'Type'}</TableHead>
            <TableHead className="text-right">{isFr ? 'Réel' : 'Real'}</TableHead>
            <TableHead className="text-right hidden md:table-cell">{isFr ? 'Théorique' : 'Theoretical'}</TableHead>
            <TableHead className="text-right hidden md:table-cell">{isFr ? 'Écart' : 'Gap'}</TableHead>
            <TableHead className="text-right w-32">{isFr ? 'Actions' : 'Actions'}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accounts.map(a => {
            const real = Number(a.real_balance || 0);
            const theo = theoreticalBalances[a.id] ?? Number(a.opening_balance || 0);
            const gap = real - theo;
            const hasGap = Math.abs(gap) > 0.01;
            const isArchived = !!a.archived_at;
            return (
              <TableRow key={a.id} className={`${selectedIds.has(a.id) ? 'bg-primary/5' : ''} ${isArchived ? 'opacity-60' : ''} hover:bg-muted/30`}>
                <TableCell>
                  <Checkbox checked={selectedIds.has(a.id)} onCheckedChange={() => onToggle(a.id)} />
                </TableCell>
                <TableCell>
                  <button onClick={() => onDrilldown(a)} className="flex items-center gap-2 hover:text-primary transition-colors text-left">
                    <span className="text-lg">{a.icon}</span>
                    <span className="font-medium truncate">{a.name}</span>
                    {isArchived && <Archive className="w-3 h-3 text-muted-foreground" />}
                  </button>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant="secondary" className="text-[10px] rounded-md">
                    {TYPE_LABELS[a.type]?.[isFr ? 'fr' : 'en'] || a.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-bold tabular-nums">{fmt(real)}</TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums hidden md:table-cell">{fmt(theo)}</TableCell>
                <TableCell className={`text-right tabular-nums hidden md:table-cell ${hasGap ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                  {hasGap ? (
                    <span className="inline-flex items-center gap-1 justify-end">
                      <AlertTriangle className="w-3 h-3" />
                      {gap > 0 ? '+' : ''}{fmt(gap)}
                    </span>
                  ) : '—'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onUpdateBalance(a)} title={isFr ? 'Solde' : 'Balance'}>
                      <Wallet className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onDrilldown(a)} title={isFr ? 'Stats' : 'Stats'}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEdit(a)} title={isFr ? 'Modifier' : 'Edit'}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => onDelete(a.id)} title={isFr ? 'Supprimer' : 'Delete'}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
};
