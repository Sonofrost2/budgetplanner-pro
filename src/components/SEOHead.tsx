import { useEffect } from 'react';

interface SEOHeadProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogType?: string;
  ogImage?: string;
  ogImageAlt?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  locale?: string;
  jsonLd?: Record<string, any>;
}

const SITE_NAME = 'Budget Planner Pro';
const DEFAULT_OG_IMAGE = 'https://budgetplanner-pro.lovable.app/og-image.png';

export const SEOHead = ({
  title = 'Budget Planner Pro – Gérez vos finances intelligemment',
  description = 'Application de gestion budgétaire complète : suivi des dépenses, budgets, épargne, prévisions IA et gestion familiale. Disponible en français et anglais.',
  canonical,
  ogType = 'website',
  ogImage = DEFAULT_OG_IMAGE,
  ogImageAlt = 'Budget Planner Pro – Tableau de bord de gestion budgétaire',
  twitterCard = 'summary_large_image',
  locale = 'fr_FR',
  jsonLd,
}: SEOHeadProps) => {
  useEffect(() => {
    document.title = title;

    const setMeta = (name: string, content: string, property?: boolean) => {
      const attr = property ? 'property' : 'name';
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.content = content;
    };

    // Basic meta
    setMeta('description', description);
    setMeta('robots', 'index, follow');

    // Open Graph
    setMeta('og:title', title, true);
    setMeta('og:description', description, true);
    setMeta('og:type', ogType, true);
    setMeta('og:site_name', SITE_NAME, true);
    setMeta('og:locale', locale, true);
    setMeta('og:image', ogImage, true);
    setMeta('og:image:alt', ogImageAlt, true);
    setMeta('og:image:width', '1200', true);
    setMeta('og:image:height', '630', true);

    // Twitter Card
    setMeta('twitter:card', twitterCard);
    setMeta('twitter:title', title);
    setMeta('twitter:description', description);
    setMeta('twitter:image', ogImage);
    setMeta('twitter:image:alt', ogImageAlt);

    // Canonical & og:url
    if (canonical) {
      setMeta('og:url', canonical, true);
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = canonical;
    }

    // JSON-LD
    if (jsonLd) {
      const id = 'seo-jsonld';
      let script = document.getElementById(id) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.id = id;
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(jsonLd);
    }
  }, [title, description, canonical, ogType, ogImage, ogImageAlt, twitterCard, locale, jsonLd]);

  return null;
};
