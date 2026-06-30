import { useEffect } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { ArrowLeft, Clock, Calendar } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';
import { getPost, BLOG_POSTS } from '@/content/blog';

const ORIGIN = 'https://budget-planner-pro.eurekaci.dev';

const BlogPostPage = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const { locale } = useLanguage();
  const post = getPost(slug);

  useEffect(() => {
    if (!post) return;
    const content = post[locale === 'en' ? 'en' : 'fr'];
    const url = `${ORIGIN}/blog/${post.slug}`;
    document.title = `${content.title} — Budget Planner Pro`;

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
    setMeta('meta[name="description"]', 'content', content.summary);
    setMeta('link[rel="canonical"]', 'href', url);
    setMeta('meta[property="og:title"]', 'content', content.title);
    setMeta('meta[property="og:description"]', 'content', content.summary);
    setMeta('meta[property="og:url"]', 'content', url);
    setMeta('meta[property="og:type"]', 'content', 'article');

    const ldId = 'blog-post-jsonld';
    document.getElementById(ldId)?.remove();
    const script = document.createElement('script');
    script.id = ldId;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify([
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: content.title,
        description: content.summary,
        datePublished: post.date,
        dateModified: post.date,
        inLanguage: locale,
        articleSection: post.tag,
        mainEntityOfPage: url,
        author: { '@type': 'Organization', name: 'Budget Planner Pro', url: ORIGIN },
        publisher: {
          '@type': 'Organization',
          name: 'Budget Planner Pro',
          url: ORIGIN,
          logo: { '@type': 'ImageObject', url: `${ORIGIN}/icons/icon-512.png` },
        },
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: ORIGIN },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${ORIGIN}/blog` },
          { '@type': 'ListItem', position: 3, name: content.title, item: url },
        ],
      },
    ]);
    document.head.appendChild(script);
    return () => { document.getElementById(ldId)?.remove(); };
  }, [post, locale]);

  if (!post) return <Navigate to="/blog" replace />;
  const content = post[locale === 'en' ? 'en' : 'fr'];
  const related = BLOG_POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);
  const dateFmt = new Date(post.date).toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-24 pb-16 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-3">
          <Link to="/blog"><ArrowLeft className="h-4 w-4 mr-1" />{locale === 'en' ? 'Back to blog' : 'Retour au blog'}</Link>
        </Button>

        <div className="flex items-center gap-3 mb-4">
          <Badge variant="secondary">{post.tag}</Badge>
          <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" />{dateFmt}</span>
          <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{post.readingMinutes} min</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">{content.title}</h1>
        <p className="text-lg text-muted-foreground mb-8 leading-relaxed">{content.summary}</p>

        <article className="space-y-5">
          {content.body.map((para, i) => (
            <p key={i} className="text-foreground/90 leading-relaxed">{para}</p>
          ))}
        </article>

        <hr className="my-12 border-border" />

        <section>
          <h2 className="text-xl font-semibold mb-4">{locale === 'en' ? 'Keep reading' : 'À lire ensuite'}</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {related.map((r) => {
              const rc = r[locale === 'en' ? 'en' : 'fr'];
              return (
                <Link key={r.slug} to={`/blog/${r.slug}`} className="group rounded-lg border bg-card p-4 hover:bg-accent/40 transition-colors">
                  <Badge variant="secondary" className="mb-2">{r.tag}</Badge>
                  <div className="font-medium text-sm group-hover:text-primary line-clamp-2">{rc.title}</div>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default BlogPostPage;