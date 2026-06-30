import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Mail, Trash2, ExternalLink } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/i18n/LanguageContext';

const ORIGIN = 'https://budget-planner-pro.eurekaci.dev';

const AccountDeletionPage = () => {
  const { locale } = useLanguage();
  const lang = locale === 'en' ? 'en' : 'fr';

  useEffect(() => {
    const url = `${ORIGIN}/account-deletion`;
    const title = lang === 'en'
      ? 'Delete your account — Budget Planner Pro'
      : 'Supprimer votre compte — Budget Planner Pro';
    const desc = lang === 'en'
      ? 'How to permanently delete your Budget Planner Pro account and all associated personal data.'
      : 'Comment supprimer définitivement votre compte Budget Planner Pro et toutes les données personnelles associées.';
    document.title = title;
    const setMeta = (selector: string, attr: string, value: string) => {
      let el = document.head.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;
      if (!el) {
        const isLink = selector.startsWith('link');
        el = document.createElement(isLink ? 'link' : 'meta');
        const a = selector.match(/\[([^=]+)="([^"]+)"\]/);
        if (a) (el as any).setAttribute(a[1], a[2]);
        document.head.appendChild(el);
      }
      (el as any).setAttribute(attr, value);
    };
    setMeta('meta[name="description"]', 'content', desc);
    setMeta('link[rel="canonical"]', 'href', url);
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[property="og:url"]', 'content', url);
  }, [lang]);

  const t = lang === 'fr' ? {
    title: 'Supprimer votre compte',
    intro: "Conformément au RGPD et aux règles des stores Google Play et Apple App Store, vous pouvez à tout moment demander la suppression définitive de votre compte Budget Planner Pro et de toutes les données personnelles associées.",
    inAppTitle: 'Option 1 — Depuis l\'application (recommandé, immédiat)',
    inApp: [
      "Connectez-vous à votre compte sur l'app mobile ou web.",
      "Allez dans Paramètres → Compte → Zone de danger.",
      "Cliquez sur Supprimer mon compte et confirmez avec votre mot de passe.",
      "La suppression est effectuée immédiatement et est irréversible.",
    ],
    openSettings: 'Ouvrir les paramètres',
    emailTitle: 'Option 2 — Par email (si vous n\'avez plus accès à l\'app)',
    email: [
      "Envoyez un email à comptabilite@eurekaci.dev depuis l'adresse associée à votre compte.",
      "Objet : « Suppression de compte Budget Planner Pro ».",
      "Nous traitons votre demande sous 7 jours ouvrés et vous envoyons une confirmation.",
    ],
    scopeTitle: 'Ce qui est supprimé',
    scope: [
      "Profil (email, nom, préférences de langue, thème, devise).",
      "Toutes vos transactions, budgets, comptes, objectifs d'épargne, dettes.",
      "Vos paramètres de notifications et tokens push.",
      "L'historique de connexion et les sessions actives.",
    ],
    retentionTitle: 'Ce qui est conservé (obligations légales)',
    retention: [
      "Les factures et reçus de paiement, conservés 10 ans pour conformité fiscale (loi OHADA).",
      "Les logs de sécurité anonymisés, conservés 12 mois pour la détection de fraude.",
      "Aucune de ces données ne contient d'information financière personnelle utilisable.",
    ],
    irreversible: "Cette opération est irréversible. Pensez à exporter vos données (Paramètres → Export CSV/PDF) avant de procéder.",
    contact: "Pour toute question, contactez-nous à",
  } : {
    title: 'Delete your account',
    intro: "In accordance with GDPR and Google Play / Apple App Store policies, you can request permanent deletion of your Budget Planner Pro account and all associated personal data at any time.",
    inAppTitle: 'Option 1 — From the app (recommended, immediate)',
    inApp: [
      "Sign in to your account on the mobile or web app.",
      "Go to Settings → Account → Danger zone.",
      "Tap Delete my account and confirm with your password.",
      "Deletion is performed immediately and is irreversible.",
    ],
    openSettings: 'Open settings',
    emailTitle: "Option 2 — By email (if you no longer have access to the app)",
    email: [
      "Send an email to comptabilite@eurekaci.dev from the address linked to your account.",
      "Subject: \"Budget Planner Pro — Account deletion\".",
      "We process your request within 7 business days and send a confirmation.",
    ],
    scopeTitle: 'What is deleted',
    scope: [
      "Profile (email, name, language/theme/currency preferences).",
      "All your transactions, budgets, accounts, savings goals, debts.",
      "Notification settings and push tokens.",
      "Login history and active sessions.",
    ],
    retentionTitle: 'What is retained (legal obligations)',
    retention: [
      "Invoices and payment receipts, kept for 10 years for tax compliance (OHADA law).",
      "Anonymized security logs, kept for 12 months for fraud detection.",
      "None of this data contains usable personal financial information.",
    ],
    irreversible: "This action is irreversible. Make sure to export your data (Settings → CSV/PDF export) before proceeding.",
    contact: "For any question, contact us at",
  };

  const Section = ({ title, items }: { title: string; items: string[] }) => (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <h2 className="text-lg font-semibold mb-3">{title}</h2>
        <ul className="space-y-2 list-disc pl-5 text-muted-foreground">
          {items.map((i, k) => <li key={k}>{i}</li>)}
        </ul>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-destructive/10"><Trash2 className="h-5 w-5 text-destructive" aria-hidden /></div>
          <h1 className="text-3xl sm:text-4xl font-bold">{t.title}</h1>
        </div>
        <p className="text-muted-foreground mb-8 leading-relaxed">{t.intro}</p>

        <Card className="mb-6 border-primary/30">
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-3">{t.inAppTitle}</h2>
            <ol className="space-y-2 list-decimal pl-5 text-muted-foreground mb-4">
              {t.inApp.map((i, k) => <li key={k}>{i}</li>)}
            </ol>
            <Button asChild>
              <Link to="/dashboard/settings"><ExternalLink className="h-4 w-4 mr-2" />{t.openSettings}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Mail className="h-4 w-4" />{t.emailTitle}</h2>
            <ol className="space-y-2 list-decimal pl-5 text-muted-foreground">
              {t.email.map((i, k) => <li key={k}>{i}</li>)}
            </ol>
          </CardContent>
        </Card>

        <Section title={t.scopeTitle} items={t.scope} />
        <Section title={t.retentionTitle} items={t.retention} />

        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex gap-3 mb-6">
          <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" aria-hidden />
          <p className="text-sm text-foreground">{t.irreversible}</p>
        </div>

        <p className="text-sm text-muted-foreground">
          {t.contact} <a className="underline" href="mailto:comptabilite@eurekaci.dev">comptabilite@eurekaci.dev</a>.
        </p>
      </main>
      <Footer />
    </div>
  );
};

export default AccountDeletionPage;