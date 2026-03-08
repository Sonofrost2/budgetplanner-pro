import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useLanguage } from '@/i18n/LanguageContext';
import { useParams } from 'react-router-dom';

const pages: Record<string, Record<string, { title: string; content: string[] }>> = {
  privacy: {
    fr: {
      title: 'Politique de confidentialité',
      content: [
        'Budget Planner accorde une importance primordiale à la protection de vos données personnelles.',
        'Les données que nous collectons (email, nom, transactions financières) sont utilisées uniquement pour fournir nos services. Elles ne sont jamais vendues ni partagées avec des tiers à des fins commerciales.',
        'Vos données financières sont chiffrées en transit (TLS) et au repos. Nous utilisons des infrastructures sécurisées hébergées en conformité avec les standards internationaux.',
        'Vous pouvez à tout moment demander la suppression de votre compte et de toutes vos données en nous contactant.',
        'Dernière mise à jour : Mars 2026.',
      ],
    },
    en: {
      title: 'Privacy Policy',
      content: [
        'Budget Planner places the highest importance on protecting your personal data.',
        'The data we collect (email, name, financial transactions) is used solely to provide our services. It is never sold or shared with third parties for commercial purposes.',
        'Your financial data is encrypted in transit (TLS) and at rest. We use secure infrastructure hosted in compliance with international standards.',
        'You can request the deletion of your account and all your data at any time by contacting us.',
        'Last updated: March 2026.',
      ],
    },
  },
  terms: {
    fr: {
      title: "Conditions d'utilisation",
      content: [
        "En utilisant Budget Planner, vous acceptez les présentes conditions d'utilisation.",
        "Le service est fourni « en l'état ». Nous nous efforçons d'assurer sa disponibilité et sa fiabilité, mais ne garantissons pas un fonctionnement ininterrompu.",
        "Vous êtes responsable de la confidentialité de vos identifiants de connexion et de l'exactitude des données que vous saisissez.",
        "L'abonnement Premium est facturé mensuellement. Vous pouvez résilier à tout moment depuis les paramètres de votre compte. La résiliation prend effet à la fin de la période en cours.",
        "Nous nous réservons le droit de modifier ces conditions. Toute modification sera communiquée par email ou via l'application.",
        'Dernière mise à jour : Mars 2026.',
      ],
    },
    en: {
      title: 'Terms of Service',
      content: [
        'By using Budget Planner, you agree to these terms of service.',
        'The service is provided "as is." We strive to ensure its availability and reliability, but do not guarantee uninterrupted operation.',
        'You are responsible for the confidentiality of your login credentials and the accuracy of the data you enter.',
        'Premium subscription is billed monthly. You can cancel at any time from your account settings. Cancellation takes effect at the end of the current period.',
        'We reserve the right to modify these terms. Any changes will be communicated via email or through the application.',
        'Last updated: March 2026.',
      ],
    },
  },
  cookies: {
    fr: {
      title: 'Politique de cookies',
      content: [
        "Budget Planner utilise des cookies strictement nécessaires au fonctionnement de l'application (authentification, préférences de langue et de thème).",
        "Nous n'utilisons pas de cookies publicitaires ni de trackers tiers.",
        "Les cookies de session sont supprimés à la déconnexion. Les cookies de préférences sont stockés localement sur votre appareil.",
        'Dernière mise à jour : Mars 2026.',
      ],
    },
    en: {
      title: 'Cookie Policy',
      content: [
        'Budget Planner uses cookies strictly necessary for the operation of the application (authentication, language and theme preferences).',
        'We do not use advertising cookies or third-party trackers.',
        'Session cookies are deleted on logout. Preference cookies are stored locally on your device.',
        'Last updated: March 2026.',
      ],
    },
  },
};

const LegalPage = () => {
  const { locale } = useLanguage();
  const { slug } = useParams<{ slug: string }>();
  const page = pages[slug || 'privacy']?.[locale] || pages.privacy[locale];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold mb-8">{page.title}</h1>
        <div className="space-y-4">
          {page.content.map((p, i) => (
            <p key={i} className="text-muted-foreground leading-relaxed">{p}</p>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default LegalPage;
