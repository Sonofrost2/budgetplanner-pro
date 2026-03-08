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
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
            <Wallet className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold font-display">Budget Planner</span>
        </div>

        {sent ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-secondary" />
            </div>
            <h1 className="text-2xl font-bold mb-3">
              {t.auth.checkEmail || 'Vérifiez votre email'}
            </h1>
            <p className="text-muted-foreground mb-6">
              {t.auth.resetEmailSent || 'Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.'}
            </p>
            <Link to="/login">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                {t.auth.login}
              </Button>
            </Link>
          </motion.div>
        ) : (
          <>
            <h1 className="text-2xl font-bold">{t.auth.forgotPassword}</h1>
            <p className="mt-2 text-muted-foreground">
              {t.auth.forgotPasswordDesc || 'Entrez votre email pour recevoir un lien de réinitialisation.'}
            </p>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">{t.auth.email}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" className="pl-10" required />
                </div>
              </div>

              <Button type="submit" className="w-full text-primary-foreground" style={{ background: 'var(--gradient-primary)' }} disabled={loading}>
                {loading ? '...' : (t.auth.sendResetLink || 'Envoyer le lien')}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              <Link to="/login" className="text-primary font-semibold hover:underline flex items-center justify-center gap-1">
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
