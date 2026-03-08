import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Wallet, Lock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const ResetPassword = () => {
  const { t } = useLanguage();
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
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
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
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--gradient-primary)' }}>
            <Wallet className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold font-display">Budget Planner</span>
        </div>

        {success ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
            <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-secondary" />
            </div>
            <h1 className="text-2xl font-bold mb-3">{t.auth.passwordUpdated || 'Mot de passe mis à jour'}</h1>
            <p className="text-muted-foreground mb-6">{t.auth.passwordUpdatedDesc || 'Votre mot de passe a été modifié avec succès.'}</p>
            <Link to="/login">
              <Button className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }}>
                {t.auth.login}
              </Button>
            </Link>
          </motion.div>
        ) : (
          <>
            <h1 className="text-2xl font-bold">{t.auth.newPassword || 'Nouveau mot de passe'}</h1>
            <p className="mt-2 text-muted-foreground">{t.auth.newPasswordDesc || 'Choisissez un nouveau mot de passe pour votre compte.'}</p>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="password">{t.auth.password}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pl-10" required minLength={6} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t.auth.confirmPassword}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="pl-10" required minLength={6} />
                </div>
              </div>

              <Button type="submit" className="w-full text-primary-foreground" style={{ background: 'var(--gradient-primary)' }} disabled={loading}>
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
