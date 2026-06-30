import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useLanguage } from '@/i18n/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';
import { BLOG_POSTS } from '@/content/blog';

const BlogPage = () => {
  const { locale } = useLanguage();
  const lang = locale === 'en' ? 'en' : 'fr';
  const posts = BLOG_POSTS;

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
        headline: p[lang].title,
        datePublished: p.date,
        articleSection: p.tag,
        description: p[lang].summary,
        url: `${origin}/blog/${p.slug}`,
        author: { '@type': 'Organization', name: 'Budget Planner Pro' },
      })),
    });
    document.head.appendChild(script);
    return () => { document.getElementById(ldId)?.remove(); };
  }, [locale, posts, lang]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold mb-3">{locale === 'fr' ? 'Blog' : 'Blog'}</h1>
        <p className="text-muted-foreground mb-10">{locale === 'fr' ? 'Conseils et actualités pour mieux gérer votre argent.' : 'Tips and news to better manage your money.'}</p>
        <div className="grid gap-6">
          {posts.map((post) => {
            const c = post[lang];
            const dateFmt = new Date(post.date).toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
            return (
              <Link key={post.slug} to={`/blog/${post.slug}`} className="block">
                <Card className="border-none shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] transition-shadow cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant="secondary">{post.tag}</Badge>
                      <span className="text-xs text-muted-foreground">{dateFmt}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{post.readingMinutes} min</span>
                    </div>
                    <CardTitle className="text-xl">{c.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground text-sm">{c.summary}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default BlogPage;
