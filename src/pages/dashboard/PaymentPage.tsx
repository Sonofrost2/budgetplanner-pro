import { useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import { dashT } from '@/i18n/dashTranslations';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Smartphone, CreditCard, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const PAYMENT_METHODS = [
  { id: 'orange', name: 'Orange Money', icon: '🟠' },
  { id: 'mtn', name: 'MTN Money', icon: '🟡' },
  { id: 'moov', name: 'Moov Money', icon: '🔵' },
  { id: 'wave', name: 'Wave', icon: '🌊' },
  { id: 'card', name: 'Carte bancaire', icon: '💳' },
];

const PaymentPage = () => {
  const { locale } = useLanguage();
  const t = dashT[locale];
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyToken, setVerifyToken] = useState('');
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);

  const handlePay = async () => {
    if (!amount || Number(amount) <= 0) {
      toast.error(locale === 'fr' ? 'Entrez un montant valide' : 'Enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('paydunya-checkout', {
        body: {
          action: 'create',
          amount: Number(amount),
          description: description || (locale === 'fr' ? 'Paiement BudgetPlanner Pro' : 'BudgetPlanner Pro Payment'),
          return_url: window.location.origin + '/dashboard',
          cancel_url: window.location.origin + '/dashboard/payment',
        },
      });

      if (error) throw error;

      if (data?.response_code === '00' && data?.response_text) {
        // Redirect to PayDunya checkout page
        window.open(data.response_text, '_blank');
        toast.success(locale === 'fr' ? 'Redirection vers PayDunya...' : 'Redirecting to PayDunya...');
        if (data.token) {
          setVerifyToken(data.token);
        }
      } else {
        toast.error(data?.response_text || (locale === 'fr' ? 'Erreur lors de la création du paiement' : 'Error creating payment'));
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verifyToken) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('paydunya-checkout', {
        body: { action: 'verify', token: verifyToken },
      });
      if (error) throw error;
      setVerifyResult(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold font-display">
        {locale === 'fr' ? 'Paiement Mobile Money' : 'Mobile Money Payment'}
      </h2>

      {/* Available payment methods */}
      <Card className="border-none shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            {locale === 'fr' ? 'Moyens de paiement disponibles' : 'Available payment methods'}
          </CardTitle>
          <CardDescription>
            {locale === 'fr' ? 'Via PayDunya — Paiement sécurisé pour l\'Afrique' : 'Via PayDunya — Secure payment for Africa'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((m) => (
              <Badge key={m.id} variant="secondary" className="text-sm py-1.5 px-3">
                {m.icon} {m.name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Payment form */}
      <Card className="border-none shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            {locale === 'fr' ? 'Effectuer un paiement' : 'Make a payment'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t.amount} (FCFA)</Label>
            <Input
              type="number"
              min="100"
              step="100"
              placeholder="5000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t.description}</Label>
            <Input
              placeholder={locale === 'fr' ? 'Description du paiement' : 'Payment description'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
            />
          </div>
          <Button
            className="w-full text-primary-foreground"
            style={{ background: 'var(--gradient-primary)' }}
            onClick={handlePay}
            disabled={loading}
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {locale === 'fr' ? 'Payer maintenant' : 'Pay now'}
          </Button>
        </CardContent>
      </Card>

      {/* Verify payment */}
      {verifyToken && (
        <Card className="border-none shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="text-lg">
              {locale === 'fr' ? 'Vérifier le paiement' : 'Verify payment'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Token: <code className="bg-muted px-2 py-0.5 rounded text-xs">{verifyToken}</code>
            </p>
            <Button variant="outline" onClick={handleVerify} disabled={verifying}>
              {verifying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {locale === 'fr' ? 'Vérifier le statut' : 'Check status'}
            </Button>
            {verifyResult && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                {verifyResult.status === 'completed' ? (
                  <CheckCircle2 className="w-5 h-5 text-secondary" />
                ) : (
                  <XCircle className="w-5 h-5 text-destructive" />
                )}
                <span className="text-sm font-medium">
                  {verifyResult.status === 'completed'
                    ? (locale === 'fr' ? 'Paiement confirmé ✓' : 'Payment confirmed ✓')
                    : (locale === 'fr' ? `Statut : ${verifyResult.status || 'en attente'}` : `Status: ${verifyResult.status || 'pending'}`)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PaymentPage;
