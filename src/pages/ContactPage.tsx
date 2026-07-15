import { useState } from 'react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import { useLanguage } from '@/i18n/LanguageContext';
import { SEOHead } from '@/components/SEOHead';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Mail, MapPin } from 'lucide-react';

const content = {
  fr: {
    title: 'Contactez-nous',
    subtitle: 'Une question, une suggestion ? Écrivez-nous et nous vous répondrons rapidement.',
    name: 'Votre nom',
    email: 'Votre email',
    message: 'Votre message',
    send: 'Envoyer',
    sent: 'Message envoyé !',
    sentDesc: 'Merci, nous reviendrons vers vous sous 48h.',
    location: 'Dakar, Sénégal',
    emailAddr: 'contact@budgetplanner.app',
  },
  en: {
    title: 'Contact Us',
    subtitle: 'Have a question or suggestion? Write to us and we\'ll get back to you quickly.',
    name: 'Your name',
    email: 'Your email',
    message: 'Your message',
    send: 'Send',
    sent: 'Message sent!',
    sentDesc: 'Thank you, we\'ll get back to you within 48h.',
    location: 'Dakar, Senegal',
    emailAddr: 'contact@budgetplanner.app',
  },
};

const ContactPage = () => {
  const { locale } = useLanguage();
  const t = content[locale];
  const [sending, setSending] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setTimeout(() => {
      setSending(false);
      toast({ title: t.sent, description: t.sentDesc });
      (e.target as HTMLFormElement).reset();
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={locale === 'fr' ? 'Contact – Budget Planner Pro' : 'Contact – Budget Planner Pro'}
        description={locale === 'fr'
          ? "Contactez l'équipe Budget Planner Pro : questions, suggestions ou support. Nous répondons sous 48h."
          : 'Get in touch with the Budget Planner Pro team for questions, suggestions or support. We reply within 48 hours.'}
        locale={locale === 'fr' ? 'fr_FR' : 'en_US'}
      />
      <Navbar />
      <main className="pt-24 pb-16 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl sm:text-4xl font-bold font-display tracking-tight mb-3">{t.title}</h1>
        <p className="text-muted-foreground mb-8">{t.subtitle}</p>

        <div className="flex flex-wrap gap-6 mb-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-primary" />{t.emailAddr}</div>
          <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" />{t.location}</div>
        </div>

        <form onSubmit={handleSubmit} className="auth-surface space-y-4">
          <Input placeholder={t.name} required className="h-11 rounded-xl bg-background/60 backdrop-blur-sm border-border/60 focus-visible:border-primary/60" />
          <Input type="email" placeholder={t.email} required className="h-11 rounded-xl bg-background/60 backdrop-blur-sm border-border/60 focus-visible:border-primary/60" />
          <Textarea placeholder={t.message} rows={5} required className="rounded-xl bg-background/60 backdrop-blur-sm border-border/60 focus-visible:border-primary/60" />
          <Button type="submit" disabled={sending} className="h-11 rounded-xl text-primary-foreground font-semibold shadow-lg shadow-primary/20" style={{ background: 'var(--gradient-primary)' }}>
            {sending ? '...' : t.send}
          </Button>
        </form>
      </main>
      <Footer />
    </div>
  );
};

export default ContactPage;
