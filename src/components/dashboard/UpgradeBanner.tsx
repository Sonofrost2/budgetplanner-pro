import { Link } from 'react-router-dom';
import { Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';

interface UpgradeBannerProps {
  message?: string;
}

const UpgradeBanner = ({ message }: UpgradeBannerProps) => {
  const { locale } = useLanguage();
  const t = dashT[locale];

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 border border-primary/20">
      <Crown className="w-5 h-5 text-primary flex-shrink-0" />
      <p className="text-sm text-foreground flex-1">{message || t.upgradePremium}</p>
      <Link to="/dashboard/payment">
        <Button size="sm" className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }}>
          {t.upgradeToPremium}
        </Button>
      </Link>
    </div>
  );
};

export default UpgradeBanner;
