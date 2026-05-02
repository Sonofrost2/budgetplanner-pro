import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Wallet, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';
import { PasswordField, evaluatePassword } from '@/components/ui/password-field';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const ResetPassword = () => {
  const { t, locale } = useLanguage();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Check if user arrived via recovery link
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    
    if (type === 'recovery') {
      setValidSession(true);
      setChecking(false);
      return;
    }

    // Also check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setValidSession(!!session);
      setChecking(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error(t.auth.confirmPassword + ' ❌');
      return;
    }
    const { score, criteria } = evaluatePassword(password);
    if (!criteria.minLength) {
      toast.error(locale === 'fr' ? 'Mot de passe trop court (8 caractères min.)' : 'Password too short (8 chars min.)');
      return;
    }
    if (score < 3) {
      toast.error(locale === 'fr' ? 'Mot de passe trop faible' : 'Password too weak');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSuccess(true);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!validSession && !checking) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">{t.auth.invalidResetLink || 'Lien invalide ou expiré'}</h1>
          <p className="text-muted-foreground mb-6">{t.auth.invalidResetLinkDesc || 'Veuillez demander un nouveau lien de réinitialisation.'}</p>
          <Link to="/forgot-password">
            <Button className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }}>
              {t.auth.forgotPassword}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

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

        {success ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6">
            <div className="w-16 h-16 rounded-2xl bg-secondary/15 ring-1 ring-secondary/30 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-secondary" />
            </div>
            <h1 className="text-2xl font-bold font-display mb-3">{t.auth.passwordUpdated || 'Mot de passe mis à jour'}</h1>
            <p className="text-sm text-muted-foreground mb-6">{t.auth.passwordUpdatedDesc || 'Votre mot de passe a été modifié avec succès.'}</p>
            <Link to="/login">
              <Button className="h-11 rounded-xl text-primary-foreground font-semibold shadow-lg shadow-primary/20" style={{ background: 'var(--gradient-primary)' }}>
                {t.auth.login}
              </Button>
            </Link>
          </motion.div>
        ) : (
          <>
            <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight">{t.auth.newPassword || 'Nouveau mot de passe'}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t.auth.newPasswordDesc || 'Choisissez un nouveau mot de passe pour votre compte.'}</p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <PasswordField
                id="password"
                label={t.auth.password}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete="new-password"
                showStrength
                showChecklist
                showGenerate
                locale={locale === 'en' ? 'en' : 'fr'}
                onGenerated={(pwd) => setConfirmPassword(pwd)}
              />
              <PasswordField
                id="confirmPassword"
                label={t.auth.confirmPassword}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete="new-password"
                showMatch
                matchValue={password}
                locale={locale === 'en' ? 'en' : 'fr'}
              />

              <Button type="submit" className="w-full h-11 rounded-xl text-primary-foreground font-semibold shadow-lg shadow-primary/20" style={{ background: 'var(--gradient-primary)' }} disabled={loading}>
                {loading ? '...' : (t.auth.updatePassword || 'Mettre à jour')}
              </Button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default ResetPassword;
