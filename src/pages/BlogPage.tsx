import { useEffect } from 'react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useLanguage } from '@/i18n/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const articles = {
  fr: [
    { title: '5 astuces pour mieux gérer son budget mensuel', tag: 'Conseils', date: '1 mars 2026', summary: "Découvrez des stratégies simples et efficaces pour reprendre le contrôle de vos dépenses chaque mois." },
    { title: 'Épargne : comment atteindre ses objectifs plus vite', tag: 'Épargne', date: '15 fév 2026', summary: "Des techniques éprouvées pour accélérer votre épargne sans sacrifier votre qualité de vie." },
    { title: 'Budget familial : les erreurs à éviter', tag: 'Famille', date: '1 fév 2026', summary: "Gérer un budget à plusieurs n'est pas toujours simple. Voici les pièges courants et comment les éviter." },
  ],
  en: [
    { title: '5 Tips to Better Manage Your Monthly Budget', tag: 'Tips', date: 'March 1, 2026', summary: 'Discover simple and effective strategies to take control of your spending every month.' },
    { title: 'Savings: How to Reach Your Goals Faster', tag: 'Savings', date: 'Feb 15, 2026', summary: 'Proven techniques to accelerate your savings without sacrificing your quality of life.' },
    { title: 'Family Budget: Mistakes to Avoid', tag: 'Family', date: 'Feb 1, 2026', summary: "Managing a budget with multiple people isn't always easy. Here are common pitfalls and how to avoid them." },
  ],
};

const BlogPage = () => {
  const { locale } = useLanguage();
  const posts = articles[locale];

  useEffect(() => {
    const origin = 'https://budget-planner-pro.eurekaci.dev';
    const title = locale === 'fr'
      ? 'Blog — Budget Planner Pro'
      : 'Blog — Budget Planner Pro';
    const desc = locale === 'fr'
      ? 'Conseils, astuces et actualités pour mieux gérer votre budget, votre épargne et vos finances familiales.'
      : 'Tips, advice and news to better manage your budget, savings and family finances.';
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
    setMeta('link[rel="canonical"]', 'href', `${origin}/blog`);
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[property="og:description"]', 'content', desc);
    setMeta('meta[property="og:url"]', 'content', `${origin}/blog`);
    setMeta('meta[property="og:type"]', 'content', 'website');

    const ldId = 'blog-jsonld';
    document.getElementById(ldId)?.remove();
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = ldId;
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: title,
      description: desc,
      url: `${origin}/blog`,
      inLanguage: locale,
      publisher: { '@type': 'Organization', name: 'Budget Planner Pro', url: origin },
      blogPost: posts.map(p => ({
        '@type': 'BlogPosting',
        headline: p.title,
        datePublished: p.date,
        articleSection: p.tag,
        description: p.summary,
        author: { '@type': 'Organization', name: 'Budget Planner Pro' },
      })),
    });
    document.head.appendChild(script);
    return () => { document.getElementById(ldId)?.remove(); };
  }, [locale, posts]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold mb-3">{locale === 'fr' ? 'Blog' : 'Blog'}</h1>
        <p className="text-muted-foreground mb-10">{locale === 'fr' ? 'Conseils et actualités pour mieux gérer votre argent.' : 'Tips and news to better manage your money.'}</p>
        <div className="grid gap-6">
          {posts.map((post, i) => (
            <Card key={i} className="border-none shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <Badge variant="secondary">{post.tag}</Badge>
                  <span className="text-xs text-muted-foreground">{post.date}</span>
                </div>
                <CardTitle className="text-xl">{post.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">{post.summary}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default BlogPage;
