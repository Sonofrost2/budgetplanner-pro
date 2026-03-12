import Navbar from '@/components/landing/Navbar';
import HeroSection from '@/components/landing/HeroSection';
import FeaturesSection from '@/components/landing/FeaturesSection';
import PricingSection from '@/components/landing/PricingSection';
import TestimonialsSection from '@/components/landing/TestimonialsSection';
import Footer from '@/components/landing/Footer';
import { SEOHead } from '@/components/SEOHead';

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Budget Planner Pro',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Web',
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
};

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Budget Planner Pro – Gérez vos finances intelligemment"
        description="Application de gestion budgétaire complète : suivi des dépenses, budgets par catégorie, objectifs d'épargne, prévisions IA et gestion familiale. Gratuit."
        canonical="https://budgetplanner-pro.lovable.app"
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
