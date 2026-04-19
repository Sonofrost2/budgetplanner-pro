import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Mail, Users } from 'lucide-react';
import { toast } from 'sonner';

interface InvitationInfo {
  id: string;
  invited_email: string;
  status: string;
  expires_at: string;
  group_id: string;
  group_name?: string;
}

const FamilyAcceptPage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) { setError('Lien invalide'); setLoading(false); return; }
    (async () => {
      const { data: inv, error: invErr } = await supabase
        .from('family_invitations')
        .select('id, invited_email, status, expires_at, group_id')
        .eq('token', token)
        .maybeSingle();

      if (invErr || !inv) {
        setError('Invitation introuvable ou déjà traitée');
        setLoading(false);
        return;
      }
      if (inv.status !== 'pending') {
        setError(`Cette invitation a déjà été ${inv.status === 'accepted' ? 'acceptée' : inv.status === 'declined' ? 'refusée' : 'traitée'}.`);
        setLoading(false);
        return;
      }
      if (new Date(inv.expires_at) < new Date()) {
        setError('Cette invitation a expiré.');
        setLoading(false);
        return;
      }

      // Fetch group name (best-effort, may fail RLS for non-members)
      const { data: group } = await supabase.from('family_groups').select('name').eq('id', inv.group_id).maybeSingle();
      setInfo({ ...inv, group_name: group?.name });
      setLoading(false);
    })();
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    const { error: rpcErr } = await supabase.rpc('accept_family_invitation', { p_token: token });
    setAccepting(false);
    if (rpcErr) { toast.error(rpcErr.message); return; }
    toast.success('Bienvenue dans le groupe ! 🎉');
    navigate('/dashboard/family');
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full border-destructive/30">
          <CardHeader className="text-center">
            <XCircle className="w-12 h-12 text-destructive mx-auto mb-2" />
            <CardTitle>Invitation invalide</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full"><Link to="/">Retour à l'accueil</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!info) return null;

  // Not logged in → redirect to signup with email pre-filled
  if (!user) {
    const redirectTo = encodeURIComponent(`/family/accept/${token}`);
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Users className="w-7 h-7 text-primary" />
            </div>
            <CardTitle>Vous êtes invité·e !</CardTitle>
            <CardDescription>
              Pour rejoindre <strong>{info.group_name || 'ce groupe familial'}</strong>, connectez-vous ou créez un compte avec l'email <strong>{info.invited_email}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild className="w-full" style={{ background: 'var(--gradient-primary)' }}>
              <Link to={`/signup?email=${encodeURIComponent(info.invited_email)}&redirect=${redirectTo}`}>Créer un compte</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to={`/login?email=${encodeURIComponent(info.invited_email)}&redirect=${redirectTo}`}>J'ai déjà un compte</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Logged in but wrong email
  if (user.email?.toLowerCase() !== info.invited_email.toLowerCase()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full border-amber-500/30">
          <CardHeader className="text-center">
            <Mail className="w-12 h-12 text-amber-500 mx-auto mb-2" />
            <CardTitle>Mauvais compte</CardTitle>
            <CardDescription>
              Cette invitation a été envoyée à <strong>{info.invited_email}</strong>, mais vous êtes connecté·e avec <strong>{user.email}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={async () => { await supabase.auth.signOut(); window.location.reload(); }} variant="outline" className="w-full">
              Se déconnecter et changer de compte
            </Button>
            <Button asChild variant="ghost" className="w-full"><Link to="/dashboard">Retour au tableau de bord</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Ready to accept
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="w-7 h-7 text-primary" />
          </div>
          <CardTitle>Rejoindre le groupe</CardTitle>
          <CardDescription>
            Vous êtes sur le point de rejoindre <strong>{info.group_name || 'ce groupe familial'}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button onClick={handleAccept} disabled={accepting} className="w-full" style={{ background: 'var(--gradient-primary)' }}>
            {accepting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Acceptation…</> : 'Accepter et rejoindre'}
          </Button>
          <Button asChild variant="ghost" className="w-full"><Link to="/dashboard">Plus tard</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default FamilyAcceptPage;
