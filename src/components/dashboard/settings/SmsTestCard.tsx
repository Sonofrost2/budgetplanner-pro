import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Send, AlertCircle, CheckCircle2, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props { locale: string }

// E.164: leading +, 1–9 first digit, 7–15 digits total
const E164 = /^\+[1-9]\d{6,14}$/;

type PhoneCheck =
  | { state: 'empty' }
  | { state: 'valid'; value: string }
  | { state: 'invalid'; reason: 'no_plus' | 'leading_zero' | 'non_digit' | 'too_short' | 'too_long' | 'malformed' };

function validatePhone(raw: string): PhoneCheck {
  const v = raw.trim().replace(/[\s().-]/g, '');
  if (!v) return { state: 'empty' };
  if (!v.startsWith('+')) return { state: 'invalid', reason: 'no_plus' };
  const digits = v.slice(1);
  if (!/^\d+$/.test(digits)) return { state: 'invalid', reason: 'non_digit' };
  if (digits.startsWith('0')) return { state: 'invalid', reason: 'leading_zero' };
  if (digits.length < 7) return { state: 'invalid', reason: 'too_short' };
  if (digits.length > 15) return { state: 'invalid', reason: 'too_long' };
  if (!E164.test(v)) return { state: 'invalid', reason: 'malformed' };
  return { state: 'valid', value: v };
}

const SmsTestCard = ({ locale }: Props) => {
  const isFr = locale === 'fr';
  const [to, setTo] = useState('');
  const [body, setBody] = useState(isFr ? 'Test Budget Planner ✅' : 'Budget Planner test ✅');
  const [sendingChannel, setSendingChannel] = useState<null | 'sms' | 'whatsapp'>(null);
  const [lastResult, setLastResult] = useState<{ channel: 'sms' | 'whatsapp'; sid: string | null } | null>(null);

  const check = useMemo(() => validatePhone(to), [to]);
  const bodyTrim = body.trim();
  const bodyError = bodyTrim.length === 0
    ? (isFr ? 'Le message ne peut pas être vide.' : 'Message cannot be empty.')
    : null;

  const phoneError = check.state === 'invalid'
    ? (() => {
        switch (check.reason) {
          case 'no_plus': return isFr ? 'Doit commencer par « + » suivi de l’indicatif pays (ex: +225…).' : 'Must start with "+" followed by the country code (e.g. +225…).';
          case 'leading_zero': return isFr ? 'Le chiffre après l’indicatif ne peut pas être 0. Retirez le 0 initial du numéro local.' : 'Digit after country code cannot be 0. Remove the leading 0 of the local number.';
          case 'non_digit': return isFr ? 'Seuls les chiffres sont autorisés après le « + ».' : 'Only digits allowed after "+".';
          case 'too_short': return isFr ? 'Numéro trop court (min. 7 chiffres après l’indicatif).' : 'Number too short (min. 7 digits after country code).';
          case 'too_long': return isFr ? 'Numéro trop long (max. 15 chiffres au total).' : 'Number too long (max. 15 digits total).';
          case 'malformed': return isFr ? 'Format E.164 invalide. Exemple attendu: +2250700000000.' : 'Invalid E.164 format. Expected example: +2250700000000.';
        }
      })()
    : null;

  const canSend = check.state === 'valid' && !bodyError && sendingChannel === null;

  const send = async (channel: 'sms' | 'whatsapp') => {
    if (check.state !== 'valid') {
      toast.error(phoneError ?? (isFr ? 'Numéro invalide.' : 'Invalid number.'));
      return;
    }
    if (bodyError) {
      toast.error(bodyError);
      return;
    }
    const fnName = channel === 'sms' ? 'send-sms' : 'send-whatsapp';
    const label = channel === 'sms' ? 'SMS' : 'WhatsApp';
    setSendingChannel(channel);
    setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: { to: check.value, body: bodyTrim },
      });
      if (error) throw error;
      const sid = (data as { sid?: string })?.sid ?? null;
      setLastResult({ channel, sid });
      toast.success(isFr ? `${label} envoyé ✅ ${sid ?? ''}` : `${label} sent ✅ ${sid ?? ''}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : (isFr ? 'Erreur inconnue' : 'Unknown error');
      toast.error(isFr ? `Échec ${label}: ${message}` : `${label} failed: ${message}`);
    } finally {
      setSendingChannel(null);
    }
  };

  const showPhoneFeedback = to.trim().length > 0;

  return (
    <Card className="border-none shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Send className="w-4 h-4" />
          {isFr ? 'Test SMS & WhatsApp (Twilio)' : 'SMS & WhatsApp Test (Twilio)'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            {isFr ? 'Destinataire (format international E.164)' : 'Recipient (E.164 international format)'}
          </Label>
          <Input
            type="tel"
            inputMode="tel"
            placeholder="+2250700000000"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-invalid={check.state === 'invalid'}
            className={`rounded-xl ${
              check.state === 'invalid' ? 'border-destructive focus-visible:ring-destructive' :
              check.state === 'valid' ? 'border-emerald-500/60 focus-visible:ring-emerald-500/40' : ''
            }`}
          />
          {showPhoneFeedback && check.state === 'invalid' && (
            <p className="text-[11px] text-destructive flex items-start gap-1.5">
              <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
              <span>{phoneError}</span>
            </p>
          )}
          {check.state === 'valid' && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3" />
              {isFr ? 'Format valide' : 'Valid format'}
            </p>
          )}
          {!showPhoneFeedback && (
            <p className="text-[11px] text-muted-foreground">
              {isFr ? 'Ex: +2250700000000 (Côte d’Ivoire), +33612345678 (France).' : 'E.g. +2250700000000 (CI), +33612345678 (FR).'}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Message</Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={320}
            rows={3}
            aria-invalid={!!bodyError}
            className={`rounded-xl resize-none ${bodyError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
          />
          <p className="text-[11px] text-muted-foreground">{body.length}/320</p>
          {bodyError && (
            <p className="text-[11px] text-destructive flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3" />
              {bodyError}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => send('sms')}
            disabled={!canSend}
            className="rounded-xl"
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            {sendingChannel === 'sms'
              ? (isFr ? 'Envoi SMS...' : 'Sending SMS...')
              : (isFr ? 'Envoyer SMS' : 'Send SMS')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => send('whatsapp')}
            disabled={!canSend}
            className="rounded-xl border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
          >
            <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
            {sendingChannel === 'whatsapp'
              ? (isFr ? 'Envoi WhatsApp...' : 'Sending WhatsApp...')
              : (isFr ? 'Envoyer WhatsApp' : 'Send WhatsApp')}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {isFr
            ? 'WhatsApp : le destinataire doit avoir rejoint le sandbox Twilio au préalable (sinon erreur 63007).'
            : 'WhatsApp: recipient must have joined the Twilio sandbox first (otherwise error 63007).'}
        </p>
        {lastResult && (
          <p className="text-[11px] text-muted-foreground font-mono break-all">
            {lastResult.channel === 'sms' ? 'SMS' : 'WhatsApp'} SID: {lastResult.sid ?? '—'}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default SmsTestCard;
