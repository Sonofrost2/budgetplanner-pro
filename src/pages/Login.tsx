import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LegalFooter from '@/components/LegalFooter';
import { Wallet, Mail, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordField, validateLoginPassword } from '@/components/ui/password-field';
import { useLanguage } from '@/i18n/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { lovable } from '@/integrations/lovable/index';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: 'easeOut' as const },
});

const Login = () => {
  const { t, locale } = useLanguage();
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error((t.auth as any).emailRequired || (locale === 'fr' ? 'Email requis' : 'Email required'));
      return;
    }
    const pwdCheck = validateLoginPassword(password, locale === 'en' ? 'en' : 'fr');
    if (!pwdCheck.ok) {
      toast.error(pwdCheck.message);
      return;
    }
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center relative overflow-hidden" style={{ background: 'var(--gradient-primary)' }}>
        {/* Animated orbs */}
        <motion.div
          className="absolute top-20 left-20 w-40 h-40 rounded-full bg-primary-foreground/10 blur-3xl"
          animate={{ scale: [1, 1.3, 1], opacity: [0.08, 0.15, 0.08] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-32 right-16 w-60 h-60 rounded-full bg-primary-foreground/10 blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.1, 0.18, 0.1] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />

        <div className="relative text-center text-primary-foreground p-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.6, type: 'spring', bounce: 0.4 }}
            className="w-16 h-16 rounded-2xl bg-primary-foreground/20 flex items-center justify-center mx-auto mb-6"
          >
            <Wallet className="w-8 h-8" />
          </motion.div>
          <motion.h2 {...fadeUp(0.2)} className="text-3xl font-bold font-display mb-4">Budget Planner</motion.h2>
          <motion.p {...fadeUp(0.35)} className="text-lg opacity-90 max-w-sm">{t.hero.subtitle}</motion.p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 -z-10" style={{ background: 'var(--gradient-mesh)' }} />
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="w-full max-w-md auth-surface">
          <motion.div {...fadeUp(0)} className="lg:hidden flex items-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20" style={{ background: 'var(--gradient-primary)' }}>
              <Wallet className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold font-display">Budget Planner</span>
          </motion.div>

          <motion.h1 {...fadeUp(0.05)} className="text-2xl sm:text-3xl font-bold font-display tracking-tight">{t.auth.loginTitle}</motion.h1>
          <motion.p {...fadeUp(0.1)} className="mt-2 text-sm text-muted-foreground">{t.auth.loginSubtitle}</motion.p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <motion.div {...fadeUp(0.15)} className="space-y-2">
              <Label htmlFor="email" className="form-label">{t.auth.email}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={(t.auth as any).emailPlaceholder || 'vous@exemple.com'} className="pl-10 h-11 rounded-xl bg-background/60 backdrop-blur-sm border-border/60 focus-visible:border-primary/60" required />
              </div>
            </motion.div>

            <motion.div {...fadeUp(0.2)} className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password" className="form-label">{t.auth.password}</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline font-semibold">{t.auth.forgotPassword}</Link>
              </div>
              <PasswordField
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                locale={locale === 'en' ? 'en' : 'fr'}
              />
            </motion.div>

            <motion.div {...fadeUp(0.25)}>
              <Button type="submit" className="w-full h-11 rounded-xl text-primary-foreground font-semibold shadow-lg shadow-primary/20" style={{ background: 'var(--gradient-primary)' }} disabled={loading}>
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t.auth.login}</> : t.auth.login}
              </Button>
            </motion.div>

            <motion.div {...fadeUp(0.28)} className="relative my-2">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/40" /></div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-wider"><span className="bg-background/80 backdrop-blur-sm px-3 py-0.5 rounded-full text-muted-foreground">{(t.auth as any).orDivider || 'ou'}</span></div>
            </motion.div>

            <motion.div {...fadeUp(0.3)}>
              <Button type="button" variant="outline" className="w-full h-11 rounded-xl bg-background/60 backdrop-blur-sm border-border/60 hover:bg-background" disabled={loading} onClick={async () => {
                const result = await lovable.auth.signInWithOAuth('google', { redirect_uri: window.location.origin });
                if (result.error) { toast.error(result.error.message); return; }
                if (result.redirected) return;
                navigate('/dashboard');
              }}>
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Google
              </Button>
            </motion.div>

            <motion.div {...fadeUp(0.32)}>
              <Button
                type="button"
                variant="ghost"
                className="w-full h-11 rounded-xl text-primary hover:bg-primary/10 gap-2"
                disabled={loading}
                onClick={() => navigate('/demo')}
              >
                <Sparkles className="w-4 h-4" />
                {(t.auth as any).tryDemo ||
                  (locale === 'fr' ? 'Essayer la démo sans inscription' : 'Try the demo without signup')}
              </Button>
            </motion.div>
          </form>

          <motion.p {...fadeUp(0.35)} className="mt-6 text-center text-sm text-muted-foreground">
            {t.auth.noAccount}{' '}
            <Link to="/signup" className="text-primary font-semibold hover:underline">{t.auth.signup}</Link>
          </motion.p>
          <LegalFooter variant="compact" className="mt-8 border-0 bg-transparent" />
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
