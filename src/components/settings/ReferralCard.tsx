import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gift, Copy, Check, Share2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { toast } from 'sonner';

const ReferralCard = () => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const isFr = locale === 'fr';
  const [code, setCode] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('referral_code').eq('user_id', user.id).single()
      .then(({ data }) => setCode((data as any)?.referral_code ?? ''));
  }, [user]);

  const link = code ? `${window.location.origin}/signup?ref=${code}` : '';

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success(isFr ? 'Lien copié !' : 'Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    if (!link) return;
    const text = isFr
      ? `Rejoins-moi sur Budget Planner Pro pour mieux gérer ton argent : ${link}`
      : `Join me on Budget Planner Pro to better manage your money: ${link}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Budget Planner Pro', text, url: link }); } catch {}
    } else {
      copy();
    }
  };

  return (
    <Card className="border-none shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gift className="w-4 h-4 text-primary" />
          {isFr ? 'Parrainez vos proches' : 'Refer your friends'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {isFr
            ? 'Partagez votre lien personnel. Chaque inscription via votre lien est tracée pour de futures récompenses.'
            : 'Share your personal link. Every signup via your link is tracked for future rewards.'}
        </p>
        <div className="space-y-2">
          <Label>{isFr ? 'Votre lien' : 'Your link'}</Label>
          <div className="flex gap-2">
            <Input value={link} readOnly className="rounded-xl font-mono text-xs" />
            <Button size="icon" variant="outline" className="rounded-xl shrink-0" onClick={copy} aria-label="copy">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Button size="icon" className="rounded-xl shrink-0" onClick={share} aria-label="share">
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
          {code && (
            <p className="text-xs text-muted-foreground">
              {isFr ? 'Code' : 'Code'} : <span className="font-mono font-semibold">{code}</span>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ReferralCard;