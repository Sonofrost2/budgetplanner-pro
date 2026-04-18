import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const ForgotPassword = () => {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8 bg-background relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10" style={{ background: 'var(--gradient-mesh)' }} />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md auth-surface">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20" style={{ background: 'var(--gradient-primary)' }}>
            <Wallet className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold font-display">Budget Planner</span>
        </div>

        {sent ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6">
            <div className="w-16 h-16 rounded-2xl bg-secondary/15 ring-1 ring-secondary/30 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-secondary" />
            </div>
            <h1 className="text-2xl font-bold font-display mb-3">
              {t.auth.checkEmail || 'Vérifiez votre email'}
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              {t.auth.resetEmailSent || 'Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.'}
            </p>
            <Link to="/login">
              <Button variant="outline" className="gap-2 h-11 rounded-xl bg-background/60 backdrop-blur-sm">
                <ArrowLeft className="w-4 h-4" />
                {t.auth.login}
              </Button>
            </Link>
          </motion.div>
        ) : (
          <>
            <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight">{t.auth.forgotPassword}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t.auth.forgotPasswordDesc || 'Entrez votre email pour recevoir un lien de réinitialisation.'}
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email" className="form-label">{t.auth.email}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" className="pl-10 h-11 rounded-xl bg-background/60 backdrop-blur-sm border-border/60 focus-visible:border-primary/60" required />
                </div>
              </div>

              <Button type="submit" className="w-full h-11 rounded-xl text-primary-foreground font-semibold shadow-lg shadow-primary/20" style={{ background: 'var(--gradient-primary)' }} disabled={loading}>
                {loading ? '...' : (t.auth.sendResetLink || 'Envoyer le lien')}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              <Link to="/login" className="text-primary font-semibold hover:underline inline-flex items-center justify-center gap-1">
                <ArrowLeft className="w-3 h-3" />
                {t.auth.login}
              </Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
