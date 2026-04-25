import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, AlertCircle, CheckCircle2, MessageSquareText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { SMS_TEMPLATES, renderTemplate, type SmsTemplateId } from '@/lib/smsTemplates';
import { useAuth } from '@/hooks/useAuth';

interface Props { locale: 'fr' | 'en' }

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
  const { user } = useAuth();
  const [to, setTo] = useState('');
  const [templateId, setTemplateId] = useState<SmsTemplateId>('test_ping');
  const [body, setBody] = useState(renderTemplate('test_ping', locale));
  const [sending, setSending] = useState(false);
  const [lastSid, setLastSid] = useState<string | null>(null);

  // Pre-fill recipient from saved profile phone
  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('phone').eq('user_id', user.id).maybeSingle()
      .then(({ data }) => { if (data?.phone && !to) setTo(data.phone); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Re-render template body when template or locale changes
  useEffect(() => {
    setBody(renderTemplate(templateId, locale));
  }, [templateId, locale]);

  const check = useMemo(() => validatePhone(to), [to]);
  const bodyTrim = body.trim();
  const bodyError = bodyTrim.length === 0
    ? (isFr ? 'Le message ne peut pas être vide.' : 'Message cannot be empty.')
    : null;

  const phoneError = check.state === 'invalid'
    ? (() => {
        switch (check.reason) {
          case 'no_plus': return isFr ? 'Doit commencer par « + » suivi de l’indicatif pays (ex: +225…).' : 'Must start with "+" followed by the country code (e.g. +225…).';
          case 'leading_zero': return isFr ? 'Le chiffre après l’indicatif ne peut pas être 0.' : 'Digit after country code cannot be 0.';
          case 'non_digit': return isFr ? 'Seuls les chiffres sont autorisés après le « + ».' : 'Only digits allowed after "+".';
          case 'too_short': return isFr ? 'Numéro trop court (min. 7 chiffres après l’indicatif).' : 'Number too short (min. 7 digits after country code).';
          case 'too_long': return isFr ? 'Numéro trop long (max. 15 chiffres au total).' : 'Number too long (max. 15 digits total).';
          case 'malformed': return isFr ? 'Format E.164 invalide. Exemple: +2250700000000.' : 'Invalid E.164 format. Example: +2250700000000.';
        }
      })()
    : null;

  const canSend = check.state === 'valid' && !bodyError && !sending;

  const send = async () => {
    if (check.state !== 'valid') { toast.error(phoneError ?? ''); return; }
    if (bodyError) { toast.error(bodyError); return; }
    setSending(true);
    setLastSid(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-sms', {
        body: { to: check.value, body: bodyTrim, template_id: templateId },
      });
      if (error) throw error;
      const sid = (data as { sid?: string })?.sid ?? null;
      setLastSid(sid);
      toast.success(isFr ? `SMS envoyé ✅` : `SMS sent ✅`, { description: sid ?? undefined });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : (isFr ? 'Erreur inconnue' : 'Unknown error');
      toast.error(isFr ? `Échec SMS : ${message}` : `SMS failed: ${message}`);
    } finally {
      setSending(false);
    }
  };

  const showPhoneFeedback = to.trim().length > 0;

  return (
    <Card className="border-none shadow-[var(--shadow-card)]">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Send className="w-4 h-4" />
          {isFr ? 'Test SMS — BudgetPlanner-Pro' : 'SMS Test — BudgetPlanner-Pro'}
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
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <MessageSquareText className="w-3 h-3" />
            {isFr ? 'Modèle de message' : 'Message template'}
          </Label>
          <Select value={templateId} onValueChange={(v) => setTemplateId(v as SmsTemplateId)}>
            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SMS_TEMPLATES.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {isFr ? t.label_fr : t.label_en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{isFr ? 'Aperçu (modifiable)' : 'Preview (editable)'}</Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={320}
            rows={3}
            aria-invalid={!!bodyError}
            className={`rounded-xl resize-none ${bodyError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
          />
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">{body.length}/320</p>
            <p className="text-[11px] text-muted-foreground">
              {isFr ? 'Expéditeur : ' : 'Sender: '}<span className="font-mono font-semibold text-foreground">BudgetPlanner-Pro</span>
            </p>
          </div>
          {bodyError && (
            <p className="text-[11px] text-destructive flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3" />{bodyError}
            </p>
          )}
        </div>

        <Button size="sm" onClick={send} disabled={!canSend} className="rounded-xl">
          <Send className="w-3.5 h-3.5 mr-1.5" />
          {sending ? (isFr ? 'Envoi…' : 'Sending…') : (isFr ? 'Envoyer SMS' : 'Send SMS')}
        </Button>

        {lastSid && (
          <p className="text-[11px] text-muted-foreground font-mono break-all">SID : {lastSid}</p>
        )}
      </CardContent>
    </Card>
  );
};

export default SmsTestCard;