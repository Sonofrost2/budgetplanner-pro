import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/i18n/LanguageContext';
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/lib/demo';
import { toast } from 'sonner';

/**
 * Public route /demo — auto-signs in to the shared demo account and
 * redirects to the dashboard. Surfaces a friendly intro while loading.
 */
const DemoLoginPage = () => {
  const navigate = useNavigate();
  const { locale } = useLanguage();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Sign out any existing session first so we land in the demo cleanly
      await supabase.auth.signOut();
      const { error } = await supabase.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });
      if (cancelled) return;
      if (error) {
        setError(error.message);
        toast.error(
          locale === 'fr'
            ? "Impossible d'accéder à la démo pour le moment"
            : 'Unable to access demo right now',
        );
        return;
      }
      toast.success(
        locale === 'fr'
          ? 'Bienvenue dans la démo Budget Planner ✨'
          : 'Welcome to the Budget Planner demo ✨',
      );
      navigate('/dashboard', { replace: true });
    })();
    return () => { cancelled = true; };
  }, [navigate, locale]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10" style={{ background: 'var(--gradient-mesh)' }} />
      <div className="auth-surface max-w-md w-full text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20" style={{ background: 'var(--gradient-primary)' }}>
          <Sparkles className="w-7 h-7 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-display font-bold">
          {locale === 'fr' ? 'Préparation de votre démo…' : 'Preparing your demo…'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {locale === 'fr'
            ? 'Vous accédez à un compte de démonstration partagé. Les modifications sont éphémères et réinitialisées chaque jour.'
            : 'You are entering a shared demo account. Changes are ephemeral and reset every day.'}
        </p>
        {!error && <Loader2 className="w-5 h-5 mx-auto animate-spin text-primary" />}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </div>
  );
};

export default DemoLoginPage;