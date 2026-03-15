import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Mail, Lock, User, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/i18n/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: 'easeOut' as const },
});

const Signup = () => {
  const { t } = useLanguage();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error(t.auth.confirmPassword + ' ❌');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    const { error } = await signUp(email.trim(), password, name.trim());
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
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="w-full max-w-md">
          <motion.div {...fadeUp(0)} className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
              <Wallet className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold font-display">Budget Planner</span>
          </motion.div>

          {success ? (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', bounce: 0.3 }} className="text-center py-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15, type: 'spring', bounce: 0.5 }}
                className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-6"
              >
                <CheckCircle className="w-8 h-8 text-secondary" />
              </motion.div>
              <motion.h1 {...fadeUp(0.2)} className="text-2xl font-bold mb-3">{t.auth.checkEmail || 'Vérifiez votre email'}</motion.h1>
              <motion.p {...fadeUp(0.3)} className="text-muted-foreground mb-6">
                {t.auth.checkEmailDesc || 'Un lien de confirmation a été envoyé à votre adresse email. Cliquez dessus pour activer votre compte.'}
              </motion.p>
              <motion.div {...fadeUp(0.4)}>
                <Link to="/login">
                  <Button className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }}>
                    {t.auth.login}
                  </Button>
                </Link>
              </motion.div>
            </motion.div>
          ) : (
            <>
              <motion.h1 {...fadeUp(0.05)} className="text-2xl font-bold">{t.auth.signupTitle}</motion.h1>
              <motion.p {...fadeUp(0.1)} className="mt-2 text-muted-foreground">{t.auth.signupSubtitle}</motion.p>

              <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                <motion.div {...fadeUp(0.15)} className="space-y-2">
                  <Label htmlFor="name">{t.auth.name}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jean Dupont" className="pl-10" required />
                  </div>
                </motion.div>

                <motion.div {...fadeUp(0.2)} className="space-y-2">
                  <Label htmlFor="email">{t.auth.email}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" className="pl-10" required />
                  </div>
                </motion.div>

                <motion.div {...fadeUp(0.25)} className="space-y-2">
                  <Label htmlFor="password">{t.auth.password}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pl-10" required minLength={6} />
                  </div>
                </motion.div>

                <motion.div {...fadeUp(0.3)} className="space-y-2">
                  <Label htmlFor="confirmPassword">{t.auth.confirmPassword}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="pl-10" required minLength={6} />
                  </div>
                </motion.div>

                <motion.div {...fadeUp(0.35)}>
                  <Button type="submit" className="w-full text-primary-foreground" style={{ background: 'var(--gradient-primary)' }} disabled={loading}>
                    {loading ? '...' : t.auth.signup}
                  </Button>
                </motion.div>
              </form>

              <motion.p {...fadeUp(0.4)} className="mt-6 text-center text-sm text-muted-foreground">
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
