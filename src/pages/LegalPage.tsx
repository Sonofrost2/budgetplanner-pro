import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useLanguage } from '@/i18n/LanguageContext';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { openCookieSettings } from '@/lib/cookieConsent';

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
  sales: {
    fr: {
      title: "Conditions Générales de Vente (CGV)",
      content: [
        "Cette page est maintenue par l'éditeur de Budget Planner pour répondre aux questions fréquentes sur la souscription et le paiement. Les présentes Conditions Générales de Vente (CGV) régissent la souscription aux offres payantes de Budget Planner (« le Service »).",
        "1. Éditeur — Budget Planner est édité par EurekaCI, ayant son siège à Abidjan, Côte d'Ivoire. Pour toute question commerciale ou de facturation : comptabilite@eurekaci.dev.",
        "2. Offres et prix — Les plans (Free, Pro, Premium) ainsi que leurs prix mensuels ou annuels sont affichés dans l'application sur la page Facturation, en Franc CFA (XOF) par défaut ou dans la devise affichée. Les prix peuvent évoluer ; un changement n'affecte pas une période déjà payée. Les fonctionnalités incluses dans chaque plan sont décrites dans le comparatif affiché à l'écran.",
        "3. Commande et acceptation — La souscription se fait depuis la page Facturation. En cliquant sur « S'abonner », vous reconnaissez avoir pris connaissance des présentes CGV et de la Politique de remboursement, et vous les acceptez sans réserve.",
        "4. Paiement — Les paiements sont traités par notre prestataire Paystack. Les moyens acceptés sont la carte bancaire (Visa, Mastercard) et le Mobile Money (MTN, Orange, Moov, Wave selon disponibilité dans votre pays). Aucune donnée de carte n'est stockée par Budget Planner : la saisie a lieu sur la page sécurisée de Paystack.",
        "5. Activation — L'accès payant est activé automatiquement dès confirmation du paiement par Paystack, généralement en quelques secondes. En cas de paiement Mobile Money en attente, l'activation peut prendre quelques minutes. Un reçu PDF est généré et disponible dans la section Reçus.",
        "6. Durée et renouvellement — Les abonnements mensuels et annuels sont à durée déterminée. Sauf résiliation, ils ne se renouvellent PAS automatiquement par défaut : un nouveau paiement doit être initié à l'échéance pour prolonger l'accès. Vous pouvez résilier votre abonnement à tout moment depuis Paramètres › Facturation ; vous conservez l'accès jusqu'à la fin de la période payée.",
        "7. Doublons — Un utilisateur ne peut pas souscrire plusieurs fois au même plan tant qu'un abonnement à ce plan est actif et en cours de validité. Une tentative de re-souscription au même plan actif est bloquée par le système.",
        "8. Remboursement — La Politique de remboursement applicable est décrite sur la page dédiée (/legal/refund). Elle prévoit notamment un droit de remboursement inconditionnel de 7 jours pour le premier paiement, sous réserve des exclusions énoncées.",
        "9. Obligations de l'utilisateur — Vous êtes responsable de l'exactitude des informations fournies, de la confidentialité de vos identifiants et de l'utilisation conforme du Service. Toute tentative de fraude au paiement (chargeback abusif, usage de moyens de paiement non autorisés) entraîne la suspension immédiate du compte.",
        "10. Disponibilité — Le Service est fourni « en l'état ». Nous mettons en œuvre les moyens raisonnables pour assurer sa disponibilité mais ne garantissons pas un fonctionnement ininterrompu, notamment en cas de maintenance, force majeure ou panne d'un prestataire tiers (hébergement, Paystack, opérateur Mobile Money).",
        "11. Données personnelles — Le traitement de vos données est décrit dans la Politique de confidentialité (/legal/privacy). Les transactions de paiement sont traitées par Paystack en qualité de responsable conjoint de traitement.",
        "12. Modification des CGV — Nous nous réservons le droit de modifier les présentes CGV. Toute modification est communiquée par email ou via l'application au moins 15 jours avant son entrée en vigueur pour les nouvelles souscriptions.",
        "13. Droit applicable — Les présentes CGV sont régies par le droit ivoirien. Tout litige relève de la compétence exclusive des tribunaux d'Abidjan, après une tentative préalable de résolution amiable par email à comptabilite@eurekaci.dev.",
        "Dernière mise à jour : Juin 2026.",
      ],
    },
    en: {
      title: "Terms of Sale",
      content: [
        "This page is maintained by the publisher of Budget Planner to answer common questions about subscriptions and payments. These Terms of Sale govern subscriptions to Budget Planner's paid plans (the \"Service\").",
        "1. Publisher — Budget Planner is published by EurekaCI, headquartered in Abidjan, Côte d'Ivoire. For any billing or commercial inquiry: comptabilite@eurekaci.dev.",
        "2. Plans and prices — The Free, Pro and Premium plans and their monthly or yearly prices are displayed in-app on the Billing page, in West African CFA Franc (XOF) by default or in the currency shown. Prices may change; a change does not affect a period already paid. Features included in each plan are listed in the comparison table shown on screen.",
        "3. Order and acceptance — You subscribe from the Billing page. By clicking \"Subscribe\", you acknowledge having read these Terms of Sale and the Refund Policy and accept them without reservation.",
        "4. Payment — Payments are processed by our provider Paystack. Accepted methods are card payments (Visa, Mastercard) and Mobile Money (MTN, Orange, Moov, Wave depending on availability in your country). No card data is stored by Budget Planner: card details are entered on Paystack's secure page.",
        "5. Activation — Paid access is enabled automatically upon Paystack payment confirmation, usually within seconds. Mobile Money payments awaiting confirmation may take a few minutes. A PDF receipt is generated and available in the Receipts section.",
        "6. Duration and renewal — Monthly and yearly subscriptions are fixed-term. Unless otherwise stated, they do NOT auto-renew by default: a new payment must be initiated at expiry to continue. You may cancel at any time from Settings › Billing; you keep access until the end of the paid period.",
        "7. Duplicates — A user cannot subscribe multiple times to the same plan while an active subscription to that plan is still valid. Re-subscription attempts to the same active plan are blocked by the system.",
        "8. Refund — The applicable Refund Policy is described on its dedicated page (/legal/refund). It includes an unconditional 7-day refund right on the first payment, subject to the stated exclusions.",
        "9. User obligations — You are responsible for the accuracy of the information you provide, the confidentiality of your credentials, and compliant use of the Service. Any payment fraud (abusive chargeback, unauthorized payment method) leads to immediate account suspension.",
        "10. Availability — The Service is provided \"as is\". We use reasonable means to ensure availability but do not guarantee uninterrupted operation, in particular during maintenance, force majeure or third-party outages (hosting, Paystack, Mobile Money operators).",
        "11. Personal data — Processing of your data is described in our Privacy Policy (/legal/privacy). Payment transactions are processed by Paystack as joint data controller.",
        "12. Changes to the Terms — We reserve the right to amend these Terms of Sale. Any change is communicated by email or via the application at least 15 days before entry into force for new subscriptions.",
        "13. Governing law — These Terms are governed by Ivorian law. Any dispute is subject to the exclusive jurisdiction of the courts of Abidjan, after a prior good-faith attempt to resolve the dispute by email to comptabilite@eurekaci.dev.",
        "Last updated: June 2026.",
      ],
    },
  },
  refund: {
    fr: {
      title: "Politique de remboursement (7 jours)",
      content: [
        "Cette page est maintenue par l'éditeur de Budget Planner pour expliquer les conditions de remboursement de nos abonnements payants. Elle complète les Conditions Générales de Vente (/legal/sales).",
        "1. Principe — Vous bénéficiez d'un droit de remboursement inconditionnel de sept (7) jours calendaires à compter du premier paiement effectif d'un abonnement Pro ou Premium. Aucune justification n'est requise pendant cette période.",
        "2. Comment demander un remboursement — Envoyez un email à comptabilite@eurekaci.dev depuis l'adresse associée à votre compte, avec en objet « Demande de remboursement » et en mentionnant la référence de paiement Paystack visible dans la section Reçus. Une confirmation est envoyée sous 2 jours ouvrés.",
        "3. Délai de traitement — Une fois la demande acceptée, le remboursement est exécuté via Paystack sur le moyen de paiement original (carte ou Mobile Money). Le crédit effectif dépend de l'opérateur : 1 à 3 jours ouvrés pour Mobile Money, jusqu'à 10 jours ouvrés pour les cartes.",
        "4. Effet sur l'abonnement — Dès l'acceptation de la demande, l'abonnement est résilié, le compte revient au plan Gratuit et les fonctionnalités payantes sont désactivées. Les données saisies restent accessibles dans les limites du plan Gratuit.",
        "5. Exclusions — Les cas suivants ne sont PAS éligibles au remboursement, même dans les 7 jours :",
        "    • Les renouvellements et re-souscriptions au même plan (le droit de 7 jours s'applique uniquement au premier paiement initial).",
        "    • Les upgrades partiels ou prorata déjà consommés (passage Pro → Premium en cours de période).",
        "    • Les comptes ayant fait l'objet d'une suspension pour fraude au paiement, chargeback ou violation des CGV.",
        "    • Les achats effectués avec un code promotionnel à -50 % ou plus, sauf erreur manifeste de notre part.",
        "    • Les frais facturés par votre opérateur Mobile Money ou banque (qui ne sont jamais perçus par Budget Planner).",
        "6. Au-delà des 7 jours — Passé ce délai, aucun remboursement n'est dû. Vous conservez l'accès à votre abonnement jusqu'à la fin de la période payée et pouvez résilier à tout moment depuis Paramètres › Facturation pour empêcher tout nouveau paiement.",
        "7. Cas particuliers — En cas de défaillance technique majeure imputable à Budget Planner ayant rendu le Service indisponible plus de 72 heures consécutives sur la période payée, un remboursement au prorata ou un avoir équivalent peut être accordé, sur demande, indépendamment du délai de 7 jours.",
        "8. Contact et litiges — Pour toute contestation, écrivez à comptabilite@eurekaci.dev. À défaut d'accord amiable dans un délai de 30 jours, les tribunaux d'Abidjan sont seuls compétents conformément au droit ivoirien.",
        "Dernière mise à jour : Juin 2026.",
      ],
    },
    en: {
      title: "Refund Policy (7 days)",
      content: [
        "This page is maintained by the publisher of Budget Planner to explain the refund terms for our paid subscriptions. It complements the Terms of Sale (/legal/sales).",
        "1. Principle — You benefit from an unconditional seven (7) calendar-day refund right starting from the first effective payment of a Pro or Premium subscription. No justification is required during this window.",
        "2. How to request a refund — Send an email to comptabilite@eurekaci.dev from the address linked to your account, with the subject \"Refund request\" and the Paystack payment reference shown in the Receipts section. We confirm receipt within 2 business days.",
        "3. Processing time — Once the request is accepted, the refund is issued via Paystack to the original payment method (card or Mobile Money). Effective credit depends on the operator: 1–3 business days for Mobile Money, up to 10 business days for cards.",
        "4. Effect on the subscription — Upon acceptance, the subscription is cancelled, the account reverts to the Free plan and paid features are disabled. Your data remains accessible within the Free plan limits.",
        "5. Exclusions — The following cases are NOT eligible for refund, even within the 7-day window:",
        "    • Renewals and re-subscriptions to the same plan (the 7-day right only applies to the first initial payment).",
        "    • Partial upgrades or pro-rata already consumed (Pro → Premium upgrade mid-period).",
        "    • Accounts suspended for payment fraud, chargeback or breach of the Terms of Sale.",
        "    • Purchases made with a promotional code of -50% or more, except in case of manifest error on our side.",
        "    • Fees charged by your Mobile Money operator or bank (which are never collected by Budget Planner).",
        "6. After 7 days — Past this window, no refund is owed. You keep access to your subscription until the end of the paid period and may cancel at any time from Settings › Billing to prevent further payments.",
        "7. Special cases — In case of a major technical failure attributable to Budget Planner causing the Service to be unavailable for more than 72 consecutive hours during the paid period, a pro-rata refund or equivalent credit may be granted upon request, independently of the 7-day window.",
        "8. Contact and disputes — For any dispute, write to comptabilite@eurekaci.dev. Failing an amicable agreement within 30 days, the courts of Abidjan have exclusive jurisdiction under Ivorian law.",
        "Last updated: June 2026.",
      ],
    },
  },
  cookies: {
    fr: {
      title: 'Politique de cookies',
      content: [
        "Budget Planner utilise trois catégories de cookies et technologies similaires :",
        "1. Strictement nécessaires — authentification, préférences de langue et de thème, sécurité (protection CSRF, rate-limiting). Toujours actifs, ils ne requièrent pas votre consentement.",
        "2. Mesure d'audience — statistiques internes anonymisées (pages vues, performances) afin d'améliorer le produit. Activables avec votre accord.",
        "3. Marketing — pixels Meta (Facebook/Instagram) et TikTok permettant de mesurer l'efficacité de nos campagnes publicitaires et d'afficher des publicités pertinentes. Activables avec votre accord uniquement.",
        "Vous pouvez à tout moment modifier vos préférences via le bouton « Gérer mes cookies » ci-dessous. Le refus n'altère pas le fonctionnement de l'application.",
        "Vos choix sont stockés localement sur votre appareil. Nous respectons l'en-tête « Do Not Track » de votre navigateur.",
        "Dernière mise à jour : Juin 2026.",
      ],
    },
    en: {
      title: 'Cookie Policy',
      content: [
        'Budget Planner uses three categories of cookies and similar technologies:',
        '1. Strictly necessary — authentication, language/theme preferences, security (CSRF protection, rate-limiting). Always on, no consent required.',
        '2. Audience measurement — anonymized internal analytics (page views, performance) used to improve the product. Opt-in.',
        '3. Marketing — Meta (Facebook/Instagram) and TikTok pixels used to measure our ad campaigns and display relevant ads. Opt-in only.',
        'You can change your preferences at any time via the "Manage my cookies" button below. Declining does not affect the operation of the app.',
        'Your choices are stored locally on your device. We honor your browser\'s "Do Not Track" header.',
        'Last updated: June 2026.',
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
        {slug === 'cookies' && (
          <div className="mt-8">
            <Button onClick={openCookieSettings}>
              {locale === 'en' ? 'Manage my cookies' : 'Gérer mes cookies'}
            </Button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default LegalPage;
