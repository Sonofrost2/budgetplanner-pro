import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  if (accounts.length === 0) return null;

  const grouped: Record<string, { total: number; count: number }> = {};
  accounts.forEach(a => {
    const type = a.type || 'other';
    if (!grouped[type]) grouped[type] = { total: 0, count: 0 };
    grouped[type].total += Number(a.real_balance);
    grouped[type].count += 1;
  });

  const total = accounts.reduce((s: number, a: any) => s + Number(a.real_balance), 0);
  const labels = typeLabels[locale] || typeLabels.en;

  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="text-sm font-bold mb-3">{(t as any).accountsSummary || 'Synthèse comptes'}</h3>
      <div className="space-y-1.5">
        {Object.entries(grouped).map(([type, { total: subtotal, count }]) => (
          <div key={type}
            className="flex items-center justify-between py-2 px-2.5 rounded-xl hover:bg-muted/30 cursor-pointer active:scale-[0.98] transition-all"
            onClick={() => navigate(`/dashboard/accounts?type=${type}`)}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{typeIcons[type] || '💳'}</span>
              <div>
                <p className="text-xs font-medium">{labels[type] || type}</p>
                <p className="text-[10px] text-muted-foreground">{count} {locale === 'fr' ? 'compte(s)' : 'account(s)'}</p>
              </div>
            </div>
            <span className="text-xs font-bold">{fmt(subtotal)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-2.5 mt-1.5 border-t border-glass-border">
          <span className="text-xs font-bold">{(t as any).savingsTotal || 'Total'}</span>
          <span className="text-sm font-extrabold">{fmt(total)}</span>
        </div>
      </div>
    </div>
  );
};
