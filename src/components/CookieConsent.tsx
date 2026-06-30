import { useEffect, useState } from 'react';
import { Cookie, Shield, BarChart3, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'react-router-dom';
import { getConsent, setConsent, acceptAll, rejectAll } from '@/lib/cookieConsent';

const COPY = {
  fr: {
    title: 'Vos préférences de cookies',
    intro: "Nous utilisons des cookies pour faire fonctionner l'application, mesurer son audience et améliorer votre expérience. Vous pouvez accepter, refuser ou personnaliser à tout moment.",
    necessary: 'Strictement nécessaires',
    necessaryDesc: "Authentification, préférences de langue/thème, sécurité. Toujours actifs.",
    analytics: 'Mesure d\'audience',
    analyticsDesc: 'Statistiques anonymisées pour améliorer le produit.',
    marketing: 'Marketing',
    marketingDesc: 'Pixels Meta / TikTok pour mesurer nos campagnes publicitaires.',
    acceptAll: 'Tout accepter',
    rejectAll: 'Tout refuser',
    customize: 'Personnaliser',
    save: 'Enregistrer mes choix',
    learnMore: 'En savoir plus',
  },
  en: {
    title: 'Your cookie preferences',
    intro: 'We use cookies to run the app, measure its audience, and improve your experience. You can accept, decline or customize at any time.',
    necessary: 'Strictly necessary',
    necessaryDesc: 'Authentication, language/theme preferences, security. Always on.',
    analytics: 'Audience measurement',
    analyticsDesc: 'Anonymized statistics to improve the product.',
    marketing: 'Marketing',
    marketingDesc: 'Meta / TikTok pixels to measure our ad campaigns.',
    acceptAll: 'Accept all',
    rejectAll: 'Reject all',
    customize: 'Customize',
    save: 'Save my choices',
    learnMore: 'Learn more',
  },
} as const;

const CookieConsent = () => {
  const { locale } = useLanguage();
  const t = COPY[locale === 'en' ? 'en' : 'fr'];
  const [open, setOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const existing = getConsent();
    if (!existing) setOpen(true);
    const handler = () => {
      const c = getConsent();
      setAnalytics(c?.analytics ?? false);
      setMarketing(c?.marketing ?? false);
      setShowDetails(true);
      setOpen(true);
    };
    window.addEventListener('bp:open-cookie-settings', handler);
    return () => window.removeEventListener('bp:open-cookie-settings', handler);
  }, []);

  const handleAcceptAll = () => { acceptAll(); setOpen(false); };
  const handleRejectAll = () => { rejectAll(); setOpen(false); };
  const handleSave = () => { setConsent({ analytics, marketing }); setOpen(false); };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { /* persistent until choice */ if (!v && getConsent()) setOpen(false); }}>
      <DialogContent className="max-w-lg" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Cookie className="h-5 w-5 text-primary" aria-hidden />
            <DialogTitle>{t.title}</DialogTitle>
          </div>
          <DialogDescription className="pt-2">{t.intro}</DialogDescription>
        </DialogHeader>

        {showDetails && (
          <div className="space-y-4 py-2">
            <Row icon={<Shield className="h-4 w-4" />} title={t.necessary} desc={t.necessaryDesc} checked disabled />
            <Row icon={<BarChart3 className="h-4 w-4" />} title={t.analytics} desc={t.analyticsDesc} checked={analytics} onChange={setAnalytics} />
            <Row icon={<Megaphone className="h-4 w-4" />} title={t.marketing} desc={t.marketingDesc} checked={marketing} onChange={setMarketing} />
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-between pt-2">
          <Link to="/legal/cookies" className="text-xs text-muted-foreground underline self-center" onClick={() => setOpen(false)}>
            {t.learnMore}
          </Link>
          <div className="flex flex-col sm:flex-row gap-2">
            {!showDetails ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setShowDetails(true)}>{t.customize}</Button>
                <Button variant="outline" size="sm" onClick={handleRejectAll}>{t.rejectAll}</Button>
                <Button size="sm" onClick={handleAcceptAll}>{t.acceptAll}</Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={handleRejectAll}>{t.rejectAll}</Button>
                <Button size="sm" onClick={handleSave}>{t.save}</Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Row = ({ icon, title, desc, checked, onChange, disabled }: {
  icon: React.ReactNode; title: string; desc: string;
  checked: boolean; onChange?: (v: boolean) => void; disabled?: boolean;
}) => (
  <div className="flex items-start justify-between gap-4 rounded-lg border bg-card/50 p-3">
    <div className="flex gap-3">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
  </div>
);

export default CookieConsent;