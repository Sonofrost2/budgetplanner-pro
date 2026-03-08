import { Link } from 'react-router-dom';
import { Wallet, Mail, Lock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/i18n/LanguageContext';
import { motion } from 'framer-motion';

const Signup = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center relative" style={{ background: 'var(--gradient-accent)' }}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-32 right-20 w-48 h-48 rounded-full bg-secondary-foreground blur-3xl" />
          <div className="absolute bottom-20 left-16 w-64 h-64 rounded-full bg-secondary-foreground blur-3xl" />
        </div>
        <div className="relative text-center text-secondary-foreground p-12">
          <div className="w-16 h-16 rounded-2xl bg-secondary-foreground/20 flex items-center justify-center mx-auto mb-6">
            <Wallet className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-bold font-[Space_Grotesk] mb-4">BudgetPlan</h2>
          <p className="text-lg opacity-90 max-w-sm">{t.hero.subtitle}</p>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
              <Wallet className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold font-[Space_Grotesk]">BudgetPlan</span>
          </div>

          <h1 className="text-2xl font-bold">{t.auth.signupTitle}</h1>
          <p className="mt-2 text-muted-foreground">{t.auth.signupSubtitle}</p>

          <form className="mt-8 space-y-5" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-2">
              <Label htmlFor="name">{t.auth.name}</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="name" type="text" placeholder="Jean Dupont" className="pl-10" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t.auth.email}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="email" type="email" placeholder="vous@exemple.com" className="pl-10" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t.auth.password}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="password" type="password" placeholder="••••••••" className="pl-10" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t.auth.confirmPassword}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="confirmPassword" type="password" placeholder="••••••••" className="pl-10" />
              </div>
            </div>

            <Button type="submit" className="w-full text-primary-foreground" style={{ background: 'var(--gradient-primary)' }}>
              {t.auth.signup}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t.auth.hasAccount}{' '}
            <Link to="/login" className="text-primary font-semibold hover:underline">{t.auth.login}</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Signup;
