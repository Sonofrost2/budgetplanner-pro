import Navbar from '@/components/landing/Navbar';
import HeroSection from '@/components/landing/HeroSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import PricingSection from '@/components/landing/PricingSection';
import TestimonialsSection from '@/components/landing/TestimonialsSection';
import Footer from '@/components/landing/Footer';
import { SEOHead } from '@/components/SEOHead';

const CANONICAL = 'https://budgetplanner-pro.lovable.app';

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Budget Planner Pro',
    url: CANONICAL,
    logo: `${CANONICAL}/icons/icon-512.png`,
    sameAs: [],
    description: 'Application de gestion budgétaire intelligente avec suivi des dépenses, budgets, épargne et prévisions IA.',
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: ['French', 'English'],
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Budget Planner Pro',
    url: CANONICAL,
    applicationCategory: 'FinanceApplication',
    operatingSystem: 'Web, Android, iOS',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
    },
    description: 'Application de gestion budgétaire : suivi des dépenses, budgets, épargne, prévisions IA. Gratuit.',
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      ratingCount: '10000',
    },
    screenshot: `${CANONICAL}/og-image.png`,
  },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Budget Planner Pro – Gérez vos finances intelligemment"
        description="Application de gestion budgétaire complète : suivi des dépenses, budgets par catégorie, objectifs d'épargne, prévisions IA et gestion familiale. Gratuit."
        canonical={CANONICAL}
        ogImage={`${CANONICAL}/og-image.png`}
        ogImageAlt="Budget Planner Pro – Tableau de bord avec graphiques de budget, suivi des dépenses et objectifs d'épargne"
        locale="fr_FR"
      />
      {/* JSON-LD structured data */}
      {jsonLd.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <Navbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <PricingSection />
        <TestimonialsSection />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
