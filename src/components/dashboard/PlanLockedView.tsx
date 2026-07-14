import { Link } from 'react-router-dom';
import { Crown, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';

interface PlanLockedViewProps {
  title?: string;
  message: string;
}

/**
 * Full replacement view for plan-gated pages.
 * Ensures NO premium data is rendered in the DOM when the user lacks the plan.
 */
const PlanLockedView = ({ title, message }: PlanLockedViewProps) => {
  const { locale } = useLanguage();
  const t = dashT[locale];

  return (
    <div className="space-y-6">
      {title && <h2 className="text-2xl font-bold font-display">{title}</h2>}
      <Card className="border-primary/20 bg-primary/5 shadow-[var(--shadow-card)]">
        <CardContent className="py-16 px-6 text-center flex flex-col items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2 max-w-md">
            <h3 className="text-lg font-semibold flex items-center justify-center gap-2">
              <Crown className="w-5 h-5 text-primary" />
              {locale === 'fr' ? 'Fonctionnalité réservée' : 'Feature locked'}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
          </div>
          <Link to="/dashboard/payment">
            <Button className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }}>
              {t.upgradeToPremium}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};

export default PlanLockedView;