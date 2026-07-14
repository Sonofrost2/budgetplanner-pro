import Navbar from '@/components/landing/Navbar';
import HeroSection from '@/components/landing/HeroSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import PricingSection from '@/components/landing/PricingSection';
import TestimonialsSection from '@/components/landing/TestimonialsSection';
import Footer from '@/components/landing/Footer';
import { SEOHead } from '@/components/SEOHead';

// Canonical/og:url are now resolved at runtime by <SEOHead /> from
// VITE_PUBLIC_SITE_URL or window.location.origin so they always match
// the actual domain serving the page (lovable.app, custom domain, etc.).
const CANONICAL = 'https://budgetplanner-pro.lovable.app';

/**
 * Escape sequences that could break out of a <script> tag when embedding
 * serialized JSON. Safe to apply even to fully static payloads.
 */
const escapeJsonLd = (json: string): string =>
  json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

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
      priceCurrency: 'XOF',
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
        ogImage={`${CANONICAL}/og-image.png`}
        ogImageAlt="Budget Planner Pro – Tableau de bord avec graphiques de budget, suivi des dépenses et objectifs d'épargne"
        locale="fr_FR"
      />
      {/*
        JSON-LD structured data.
        SECURITY: `jsonLd` above MUST contain only static, developer-authored
        values — never user input, URL params, or fetched content. Any dynamic
        string could contain "</script>" and break out of this <script> tag.
        If a dynamic value is ever added, escape "<" as "\u003c" in the
        serialized string (see `escapeJsonLd` below) before injection.
      */}
      {jsonLd.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: escapeJsonLd(JSON.stringify(schema)) }}
        />
      ))}
      <Navbar />
      <main id="main-content" tabIndex={-1}>
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
