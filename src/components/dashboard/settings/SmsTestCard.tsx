import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props { locale: string }

const E164 = /^\+[1-9]\d{6,14}$/;

const SmsTestCard = ({ locale }: Props) => {
  const isFr = locale === 'fr';
  const [to, setTo] = useState('');
  const [body, setBody] = useState(isFr ? 'Test Budget Planner ✅' : 'Budget Planner test ✅');
  const [sending, setSending] = useState(false);
  const [lastSid, setLastSid] = useState<string | null>(null);

  const send = async () => {
    const trimmed = to.trim();
    if (!E164.test(trimmed)) {
      toast.error(isFr
        ? 'Numéro invalide. Format: +225XXXXXXXXXX'
        : 'Invalid number. Format: +225XXXXXXXXXX');
      return;
    }
    if (!body.trim()) {
      toast.error(isFr ? 'Message vide' : 'Empty message');
      return;
    }
    setSending(true);
    setLastSid(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: { to: trimmed, body: body.trim() },
      });
      if (error) throw error;
      const sid = (data as { sid?: string })?.sid ?? null;
      setLastSid(sid);
      toast.success(isFr ? `SMS envoyé ✅ ${sid ?? ''}` : `SMS sent ✅ ${sid ?? ''}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error';
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="border-none shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Send className="w-4 h-4" />
          {isFr ? 'Test SMS (Twilio)' : 'SMS Test (Twilio)'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {isFr ? 'Destinataire (format international)' : 'Recipient (international format)'}
          </Label>
          <Input
            type="tel"
            placeholder="+2250700000000"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Message</Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={320}
            rows={3}
            className="rounded-xl resize-none"
          />
          <p className="text-[11px] text-muted-foreground">{body.length}/320</p>
        </div>
        <Button size="sm" onClick={send} disabled={sending} className="rounded-xl">
          {sending ? (isFr ? 'Envoi...' : 'Sending...') : (isFr ? 'Envoyer le test' : 'Send test')}
        </Button>
        {lastSid && (
          <p className="text-[11px] text-muted-foreground font-mono break-all">
            SID: {lastSid}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default SmsTestCard;
