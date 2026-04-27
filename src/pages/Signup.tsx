import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Wallet, Mail, Lock, User, CheckCircle, Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useLanguage } from '@/i18n/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { lovable } from '@/integrations/lovable/index';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { CountryPhoneInput } from '@/components/ui/country-phone-input';
import { useGeoCountry } from '@/hooks/useGeoCountry';
import { DEFAULT_COUNTRY_CODE, findCountryByCode } from '@/lib/countries';
import { supabase } from '@/integrations/supabase/client';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: 'easeOut' as const },
});

const Signup = () => {
  const { t } = useLanguage();
  const { signUp, user } = useAuth();
  const navigate = useNavigate();
  const geo = useGeoCountry();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneValid, setPhoneValid] = useState(false);
  const [countryCode, setCountryCode] = useState<string>(DEFAULT_COUNTRY_CODE);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [securityWarning, setSecurityWarning] = useState<string | null>(null);

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  // Auto-pick country from geolocation on first load
  useEffect(() => {
    if (geo.country && findCountryByCode(geo.country)) {
      setCountryCode(geo.country);
    }
  }, [geo.country]);

  // Run security pre-check (VPN/proxy/Tor) once geo info available
  useEffect(() => {
    if (geo.loading) return;
    supabase.functions.invoke('security-check', {
      body: { source: 'signup', declaredCountry: countryCode },
    }).then(({ data }) => {
      if (data?.flags?.isTor || data?.flags?.isVpn || data?.flags?.isProxy) {
        setSecurityWarning(
          (t as any).auth?.vpnDetected ||
            "Connexion via VPN/Proxy détectée. Pour des raisons de sécurité et d'antifraude, nous vous recommandons de désactiver votre VPN avant de créer un compte."
        );
      } else if (geo.suspectedHosting) {
        setSecurityWarning(
          (t as any).auth?.hostingDetected ||
            'Connexion suspecte détectée (datacenter). Si vous utilisez un VPN, désactivez-le pour continuer.'
        );
      }
    }).catch(() => { /* fail open */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error(t.auth.confirmPassword + ' ❌');
      return;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (!acceptTerms) {
      toast.error(t.auth.consentRequired);
      return;
    }
    if (phone && !phoneValid) {
      toast.error(t.auth.phoneInvalid);
      return;
    }
    setLoading(true);
    const { error } = await signUp(email.trim(), password, name.trim(), {
      phone: phone || undefined,
      marketingConsent,
      smsConsent: smsConsent && !!phone && phoneValid,
      termsAccepted: acceptTerms,
      countryCode,
      signupCountry: geo.country || undefined,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSuccess(true);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center relative overflow-hidden" style={{ background: 'var(--gradient-accent)' }}>
        <motion.div
          className="absolute top-32 right-20 w-48 h-48 rounded-full bg-secondary-foreground/10 blur-3xl"
          animate={{ scale: [1, 1.25, 1], opacity: [0.08, 0.14, 0.08] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-20 left-16 w-64 h-64 rounded-full bg-secondary-foreground/10 blur-3xl"
          animate={{ scale: [1.15, 1, 1.15], opacity: [0.1, 0.16, 0.1] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
        />

        <div className="relative text-center text-secondary-foreground p-12">
          <motion.div
            initial={{ opacity: 0, scale: 0.8, rotate: 10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.6, type: 'spring', bounce: 0.4 }}
            className="w-16 h-16 rounded-2xl bg-secondary-foreground/20 flex items-center justify-center mx-auto mb-6"
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

          {success ? (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', bounce: 0.3 }} className="text-center py-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15, type: 'spring', bounce: 0.5 }}
                className="w-16 h-16 rounded-2xl bg-secondary/15 ring-1 ring-secondary/30 flex items-center justify-center mx-auto mb-6"
              >
                <CheckCircle className="w-8 h-8 text-secondary" />
              </motion.div>
              <motion.h1 {...fadeUp(0.2)} className="text-2xl font-bold font-display mb-3">{t.auth.checkEmail || 'Vérifiez votre email'}</motion.h1>
              <motion.p {...fadeUp(0.3)} className="text-sm text-muted-foreground mb-6">
                {t.auth.checkEmailDesc || 'Un lien de confirmation a été envoyé à votre adresse email. Cliquez dessus pour activer votre compte.'}
              </motion.p>
              <motion.div {...fadeUp(0.4)}>
                <Link to="/login">
                  <Button className="h-11 rounded-xl text-primary-foreground font-semibold shadow-lg shadow-primary/20" style={{ background: 'var(--gradient-primary)' }}>
                    {t.auth.login}
                  </Button>
                </Link>
              </motion.div>
            </motion.div>
          ) : (
            <>
              <motion.h1 {...fadeUp(0.05)} className="text-2xl sm:text-3xl font-bold font-display tracking-tight">{t.auth.signupTitle}</motion.h1>
              <motion.p {...fadeUp(0.1)} className="mt-2 text-sm text-muted-foreground">{t.auth.signupSubtitle}</motion.p>

              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                <motion.div {...fadeUp(0.15)} className="space-y-2">
                  <Label htmlFor="name" className="form-label">{t.auth.name}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jean Dupont" className="pl-10 h-11 rounded-xl bg-background/60 backdrop-blur-sm border-border/60 focus-visible:border-primary/60" required />
                  </div>
                </motion.div>

                <motion.div {...fadeUp(0.2)} className="space-y-2">
                  <Label htmlFor="email" className="form-label">{t.auth.email}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" className="pl-10 h-11 rounded-xl bg-background/60 backdrop-blur-sm border-border/60 focus-visible:border-primary/60" required />
                  </div>
                </motion.div>

                <motion.div {...fadeUp(0.25)} className="space-y-2">
                  <Label htmlFor="password" className="form-label">{t.auth.password}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pl-10 h-11 rounded-xl bg-background/60 backdrop-blur-sm border-border/60 focus-visible:border-primary/60" required minLength={8} />
                  </div>
                </motion.div>

                <motion.div {...fadeUp(0.3)} className="space-y-2">
                  <Label htmlFor="confirmPassword" className="form-label">{t.auth.confirmPassword}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="pl-10 h-11 rounded-xl bg-background/60 backdrop-blur-sm border-border/60 focus-visible:border-primary/60" required minLength={8} />
                  </div>
                </motion.div>

                <motion.div {...fadeUp(0.32)} className="space-y-2">
                  <Label htmlFor="phone" className="form-label">{t.auth.phoneOptional}</Label>
                  <CountryPhoneInput
                    id="phone"
                    value={phone}
                    countryCode={countryCode}
                    onCountryChange={setCountryCode}
                    onChange={(e164, _cc, valid) => { setPhone(e164); setPhoneValid(valid); }}
                    detectedCountry={geo.country}
                    locale={(t as any).__locale === 'en' ? 'en' : 'fr'}
                  />
                  <p className="text-[11px] text-muted-foreground leading-snug">{t.auth.phoneHint}</p>
                </motion.div>

                {securityWarning && (
                  <motion.div {...fadeUp(0.33)} className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                    <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <p className="text-xs leading-snug text-amber-800 dark:text-amber-200">{securityWarning}</p>
                  </motion.div>
                )}

                <motion.div {...fadeUp(0.34)} className="space-y-2.5 rounded-xl border border-border/40 bg-background/40 backdrop-blur-sm p-3">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <Checkbox
                      checked={acceptTerms}
                      onCheckedChange={(v) => setAcceptTerms(v === true)}
                      className="mt-0.5"
                      required
                    />
                    <span className="text-xs leading-relaxed text-foreground/80">
                      {t.auth.acceptTerms}{' '}
                      <Link to="/legal/terms" target="_blank" className="text-primary font-medium hover:underline">{t.auth.termsLink}</Link>
                      {' '}{t.auth.andLink}{' '}
                      <Link to="/legal/privacy" target="_blank" className="text-primary font-medium hover:underline">{t.auth.privacyLink}</Link>
                      {' '}<span className="text-destructive">*</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <Checkbox
                      checked={marketingConsent}
                      onCheckedChange={(v) => setMarketingConsent(v === true)}
                      className="mt-0.5"
                    />
                    <span className="text-xs leading-relaxed text-foreground/80">{t.auth.marketingOptin}</span>
                  </label>
                  <label className={`flex items-start gap-2.5 cursor-pointer ${!phone.trim() ? 'opacity-60' : ''}`}>
                    <Checkbox
                      checked={smsConsent && !!phone.trim()}
                      onCheckedChange={(v) => setSmsConsent(v === true)}
                      disabled={!phone.trim()}
                      className="mt-0.5"
                    />
                    <span className="text-xs leading-relaxed text-foreground/80">
                      {t.auth.smsOptin}
                      {!phone.trim() && (
                        <span className="block text-[10px] text-muted-foreground mt-0.5">{t.auth.smsOptinHint}</span>
                      )}
                    </span>
                  </label>
                </motion.div>

                <motion.div {...fadeUp(0.35)}>
                  <Button type="submit" className="w-full h-11 rounded-xl text-primary-foreground font-semibold shadow-lg shadow-primary/20" style={{ background: 'var(--gradient-primary)' }} disabled={loading}>
                    {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t.auth.signup}</> : t.auth.signup}
                  </Button>
                </motion.div>

                <motion.div {...fadeUp(0.38)} className="relative my-2">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/40" /></div>
                  <div className="relative flex justify-center text-[10px] uppercase tracking-wider"><span className="bg-background/80 backdrop-blur-sm px-3 py-0.5 rounded-full text-muted-foreground">ou</span></div>
                </motion.div>

                <motion.div {...fadeUp(0.4)}>
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
              </form>

              <motion.p {...fadeUp(0.45)} className="mt-6 text-center text-sm text-muted-foreground">
                {t.auth.hasAccount}{' '}
                <Link to="/login" className="text-primary font-semibold hover:underline">{t.auth.login}</Link>
              </motion.p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default Signup;
