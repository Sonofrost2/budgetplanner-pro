import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashTranslations } from '@/i18n/dashTranslations';

interface AccountsSummaryWidgetProps {
  accounts: any[];
  fmt: (n: number) => string;
  t: DashTranslations;
  locale: string;
}

const typeLabels: Record<string, Record<string, string>> = {
  fr: { bank: 'Banque', mobile_money: 'Mobile Money', cash: 'Espèces', card: 'Carte', savings: 'Épargne', wallet: 'Portefeuille' },
  en: { bank: 'Bank', mobile_money: 'Mobile Money', cash: 'Cash', card: 'Card', savings: 'Savings', wallet: 'Wallet' },
};

const typeIcons: Record<string, string> = {
  bank: '🏦', mobile_money: '📱', cash: '💵', card: '💳', savings: '🐖', wallet: '👛',
};

export const AccountsSummaryWidget = ({ accounts, fmt, t, locale }: AccountsSummaryWidgetProps) => {
  if (accounts.length === 0) return null;

  const grouped: Record<string, { total: number; count: number }> = {};
  accounts.forEach(a => {
    const type = a.type || 'other';
    if (!grouped[type]) grouped[type] = { total: 0, count: 0 };
    grouped[type].total += Number(a.real_balance);
    grouped[type].count += 1;
  });

  const total = accounts.reduce((s, a) => s + Number(a.real_balance), 0);
  const labels = typeLabels[locale] || typeLabels.en;

  return (
    <Card className="border border-border/50 shadow-[var(--shadow-card)] rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold">{(t as any).accountsSummary || 'Synthèse comptes'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {Object.entries(grouped).map(([type, { total: subtotal, count }]) => (
          <div key={type} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
            <div className="flex items-center gap-2">
              <span className="text-lg">{typeIcons[type] || '💳'}</span>
              <div>
                <p className="text-sm font-medium">{labels[type] || type}</p>
                <p className="text-[11px] text-muted-foreground">{count} {locale === 'fr' ? 'compte(s)' : 'account(s)'}</p>
              </div>
            </div>
            <span className="text-sm font-bold">{fmt(subtotal)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-sm font-bold">{(t as any).savingsTotal || 'Total'}</span>
          <span className="text-base font-extrabold">{fmt(total)}</span>
        </div>
      </CardContent>
    </Card>
  );
};
