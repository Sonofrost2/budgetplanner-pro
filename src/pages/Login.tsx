import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Wallet, Mail, Lock } from 'lucide-react';
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

const Login = () => {
  const { t } = useLanguage();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
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
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="w-full max-w-md">
          <motion.div {...fadeUp(0)} className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
              <Wallet className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold font-display">Budget Planner</span>
          </motion.div>

          <motion.h1 {...fadeUp(0.05)} className="text-2xl font-bold">{t.auth.loginTitle}</motion.h1>
          <motion.p {...fadeUp(0.1)} className="mt-2 text-muted-foreground">{t.auth.loginSubtitle}</motion.p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <motion.div {...fadeUp(0.15)} className="space-y-2">
              <Label htmlFor="email">{t.auth.email}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" className="pl-10" required />
              </div>
            </motion.div>

            <motion.div {...fadeUp(0.2)} className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="password">{t.auth.password}</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">{t.auth.forgotPassword}</Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pl-10" required />
              </div>
            </motion.div>

            <motion.div {...fadeUp(0.25)}>
              <Button type="submit" className="w-full text-primary-foreground" style={{ background: 'var(--gradient-primary)' }} disabled={loading}>
                {loading ? '...' : t.auth.login}
              </Button>
            </motion.div>
          </form>

          <motion.p {...fadeUp(0.3)} className="mt-6 text-center text-sm text-muted-foreground">
            {t.auth.noAccount}{' '}
            <Link to="/signup" className="text-primary font-semibold hover:underline">{t.auth.signup}</Link>
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
