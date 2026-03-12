import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { useGeolocatedCurrency } from '@/hooks/useGeolocatedCurrency';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Sparkles, Wallet, Globe, CreditCard, ArrowRight, ArrowLeft, Plus, Trash2, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const STEPS = ['welcome', 'plan', 'preferences', 'accounts', 'payment', 'done'] as const;

const ACCOUNT_TYPES = [
  { value: 'mobile_money', label: '📱 Mobile Money' },
  { value: 'bank', label: '🏦 Banque' },
  { value: 'cash', label: '💵 Espèces' },
  { value: 'card', label: '💳 Carte' },
];

const OnboardingPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { locale, setLocale } = useLanguage();
  const { formatPrice } = useGeolocatedCurrency();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [plans, setPlans] = useState<Tables<'subscription_plans'>[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('free');
  const [currency, setCurrency] = useState('EUR');
  const [lang, setLang] = useState(locale);
  const [accounts, setAccounts] = useState<{ name: string; type: string; icon: string; opening_balance: string }[]>([
    { name: '', type: 'mobile_money', icon: '📱', opening_balance: '0' },
  ]);
  // Payment state
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentToken, setPaymentToken] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/login');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    supabase.from('subscription_plans').select('*').eq('active', true)
      .then(({ data }) => setPlans(data || []));
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('currency, locale, onboarding_completed').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data?.onboarding_completed) { navigate('/dashboard'); return; }
        if (data?.currency) setCurrency(data.currency);
        if (data?.locale) setLang(data.locale as 'fr' | 'en');
      });
  }, [user, navigate]);

  const addAccount = () => setAccounts(a => [...a, { name: '', type: 'mobile_money', icon: '📱', opening_balance: '0' }]);
  const removeAccount = (i: number) => setAccounts(a => a.filter((_, idx) => idx !== i));
  const updateAccount = (i: number, field: string, value: string) =>
    setAccounts(a => a.map((acc, idx) => idx === i ? { ...acc, [field]: value } : acc));

  const isPaidPlan = selectedPlan !== 'free';
  const selectedPlanData = plans.find(p => p.name === selectedPlan);

  const handlePayment = async () => {
    if (!selectedPlanData) return;
    const price = formatPrice(selectedPlanData.currency_prices || {});
    setPaymentLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('paydunya-checkout', {
        body: {
          action: 'create',
          amount: price.amount,
          description: `Budget Planner Premium - ${price.formatted}/mois`,
          return_url: window.location.origin + '/onboarding',
          cancel_url: window.location.origin + '/onboarding',
        },
      });
      if (error) throw error;
      if (data?.response_code === '00' && data?.response_text) {
        window.open(data.response_text, '_blank');
        if (data.token) setPaymentToken(data.token);
        toast.info(isFr ? 'Finalisez le paiement dans l\'onglet ouvert, puis vérifiez ici.' : 'Complete payment in the opened tab, then verify here.');
      } else {
        toast.error(data?.response_text || (isFr ? 'Erreur lors du paiement' : 'Payment error'));
      }
    } catch (err: any) {
      toast.error(err.message || 'Error');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (!paymentToken) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('paydunya-checkout', {
        body: { action: 'verify', token: paymentToken },
      });
      if (error) throw error;
      if (data?.status === 'completed') {
        setPaymentConfirmed(true);
        toast.success(isFr ? 'Paiement confirmé !' : 'Payment confirmed!');

        // Save receipt in database
        const price = formatPrice(selectedPlanData?.currency_prices || {});
        if (user) {
          await supabase.from('payment_receipts').insert({
            user_id: user.id,
            plan_name: selectedPlan,
            amount: price.amount || 0,
            currency: price.currency || currency,
            payment_token: paymentToken,
            status: 'confirmed',
          });
        }

        // Send confirmation email
        const { data: profile } = await supabase.from('profiles').select('display_name').eq('user_id', user!.id).single();
        supabase.functions.invoke('send-payment-confirmation', {
          body: {
            email: user!.email,
            displayName: profile?.display_name || user!.email,
            planName: selectedPlan === 'free' ? 'Gratuit' : 'Premium',
            amount: price.formatted || `${price.amount} ${price.currency}`,
            currency: price.currency || currency,
          },
        }).catch(err => console.error('Email confirmation error:', err));
      } else {
        toast.warning(isFr ? `Statut : ${data?.status || 'en attente'}` : `Status: ${data?.status || 'pending'}`);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleFinish = async () => {
    if (!user) return;
    await supabase.from('profiles').update({ currency, locale: lang, onboarding_completed: true }).eq('user_id', user.id);
    setLocale(lang as 'fr' | 'en');
    const validAccounts = accounts.filter(a => a.name.trim());
    if (validAccounts.length > 0) {
      await supabase.from('payment_accounts').insert(
        validAccounts.map(a => ({
          user_id: user.id,
          name: a.name.trim(),
          type: a.type,
          icon: a.icon,
          opening_balance: Number(a.opening_balance) || 0,
          real_balance: Number(a.opening_balance) || 0,
        }))
      );
    }
    toast.success(isFr ? 'Configuration terminée !' : 'Setup complete!');
    navigate('/dashboard');
  };

  // For "next" button: skip payment step if free plan
  const handleNext = () => {
    const nextIndex = step + 1;
    const nextStep = STEPS[nextIndex];
    // Skip payment step if free plan
    if (nextStep === 'payment' && !isPaidPlan) {
      setStep(nextIndex + 1);
    } else {
      setStep(nextIndex);
    }
  };

  const handleBack = () => {
    const prevIndex = step - 1;
    const prevStep = STEPS[prevIndex];
    // Skip payment step going back if free plan
    if (prevStep === 'payment' && !isPaidPlan) {
      setStep(prevIndex - 1);
    } else {
      setStep(prevIndex);
    }
  };

  const isFr = lang === 'fr';
  const currentStep = STEPS[step];

  // Determine visible steps for progress (exclude payment if free)
  const visibleSteps: string[] = isPaidPlan ? [...STEPS] : [...STEPS].filter(s => s !== 'payment');
  const visibleStepIndex = visibleSteps.indexOf(currentStep);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <Card className="w-full max-w-lg border-none shadow-[var(--shadow-elevated)]">
        <CardContent className="p-8">
          {/* Progress */}
          <div className="flex gap-1 mb-8">
            {visibleSteps.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= visibleStepIndex ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>

          {currentStep === 'welcome' && (
            <div className="text-center space-y-4">
              <Sparkles className="w-12 h-12 text-primary mx-auto" />
              <h2 className="text-2xl font-bold font-display">{isFr ? 'Bienvenue sur Budget Planner !' : 'Welcome to Budget Planner!'}</h2>
              <p className="text-muted-foreground">{isFr ? 'Configurons votre espace en quelques étapes simples.' : "Let's set up your space in a few simple steps."}</p>
              <Button className="text-primary-foreground mt-4" style={{ background: 'var(--gradient-primary)' }} onClick={() => setStep(1)}>
                {isFr ? 'Commencer' : 'Get Started'} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {currentStep === 'plan' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold font-display">{isFr ? 'Choisissez votre plan' : 'Choose your plan'}</h2>
              <div className="space-y-3">
                {plans.map(plan => {
                  const price = formatPrice(plan.currency_prices || {});
                  const isSelected = selectedPlan === plan.name;
                  return (
                    <button key={plan.id} onClick={() => setSelectedPlan(plan.name)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold capitalize">{plan.name === 'free' ? (isFr ? 'Gratuit' : 'Free') : 'Premium'}</p>
                          <p className="text-sm text-muted-foreground">
                            {plan.name === 'free' ? (isFr ? 'Fonctionnalités de base' : 'Basic features') : (isFr ? `Essai gratuit ${plan.trial_days}j` : `${plan.trial_days}-day free trial`)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">{price.formatted}</p>
                          {plan.name !== 'free' && <p className="text-xs text-muted-foreground">/{isFr ? 'mois' : 'mo'}</p>}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(plan.features || []).map((f: string, i: number) => (
                          <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded-full">{f}</span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {currentStep === 'preferences' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold font-display flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                {isFr ? 'Vos préférences' : 'Your preferences'}
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{isFr ? 'Devise' : 'Currency'}</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="XOF">XOF (CFA)</SelectItem>
                      <SelectItem value="XAF">XAF (CFA)</SelectItem>
                      <SelectItem value="CAD">CAD ($)</SelectItem>
                      <SelectItem value="CHF">CHF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{isFr ? 'Langue' : 'Language'}</Label>
                  <Select value={lang} onValueChange={v => setLang(v as 'fr' | 'en')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fr">🇫🇷 Français</SelectItem>
                      <SelectItem value="en">🇬🇧 English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'accounts' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold font-display flex items-center gap-2">
                <Wallet className="w-5 h-5 text-primary" />
                {isFr ? 'Vos comptes & moyens de paiement' : 'Your accounts & payment methods'}
              </h2>
              <p className="text-sm text-muted-foreground">{isFr ? 'Ajoutez vos comptes avec leurs soldes actuels.' : 'Add your accounts with their current balances.'}</p>
              <div className="space-y-3">
                {accounts.map((acc, i) => (
                  <div key={i} className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Input placeholder={isFr ? 'Nom du compte' : 'Account name'} value={acc.name} onChange={e => updateAccount(i, 'name', e.target.value)} />
                    </div>
                    <Select value={acc.type} onValueChange={v => updateAccount(i, 'type', v)}>
                      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ACCOUNT_TYPES.map(at => <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="number" className="w-28" placeholder={isFr ? 'Solde' : 'Balance'} value={acc.opening_balance} onChange={e => updateAccount(i, 'opening_balance', e.target.value)} />
                    {accounts.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive" onClick={() => removeAccount(i)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={addAccount}><Plus className="w-4 h-4 mr-1" />{isFr ? 'Ajouter un compte' : 'Add account'}</Button>
            </div>
          )}

          {currentStep === 'payment' && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold font-display flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                {isFr ? 'Paiement Premium' : 'Premium Payment'}
              </h2>

              {selectedPlanData && (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">Premium</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedPlanData.trial_days > 0
                          ? (isFr ? `${selectedPlanData.trial_days} jours d'essai gratuit inclus` : `${selectedPlanData.trial_days}-day free trial included`)
                          : (isFr ? 'Accès immédiat' : 'Immediate access')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{formatPrice(selectedPlanData.currency_prices || {}).formatted}</p>
                      <p className="text-xs text-muted-foreground">/{isFr ? 'mois' : 'mo'}</p>
                    </div>
                  </div>
                </div>
              )}

              {!paymentConfirmed ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {isFr
                      ? 'Cliquez sur "Payer" pour être redirigé vers la page de paiement sécurisée. Revenez ensuite ici pour vérifier.'
                      : 'Click "Pay" to be redirected to the secure payment page. Then come back here to verify.'}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {['🟠 Orange Money', '🟡 MTN', '🔵 Moov', '🌊 Wave', '💳 Carte'].map(m => (
                      <Badge key={m} variant="secondary" className="text-xs py-1 px-2">{m}</Badge>
                    ))}
                  </div>

                  <Button
                    className="w-full text-primary-foreground"
                    style={{ background: 'var(--gradient-primary)' }}
                    onClick={handlePayment}
                    disabled={paymentLoading}
                  >
                    {paymentLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {isFr ? 'Payer maintenant' : 'Pay now'}
                  </Button>

                  {paymentToken && (
                    <div className="space-y-3 pt-2 border-t border-border">
                      <p className="text-sm text-muted-foreground">
                        {isFr ? 'Paiement effectué ? Vérifiez le statut :' : 'Payment done? Check the status:'}
                      </p>
                      <Button variant="outline" className="w-full" onClick={handleVerifyPayment} disabled={verifying}>
                        {verifying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {isFr ? 'Vérifier le paiement' : 'Verify payment'}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/10 border border-secondary/30">
                  <CheckCircle2 className="w-6 h-6 text-secondary flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-secondary">{isFr ? 'Paiement confirmé !' : 'Payment confirmed!'}</p>
                    <p className="text-sm text-muted-foreground">{isFr ? 'Vous pouvez maintenant finaliser votre configuration.' : 'You can now finalize your setup.'}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 'done' && (
            <div className="text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-secondary mx-auto" />
              <h2 className="text-2xl font-bold font-display">{isFr ? 'Tout est prêt !' : "You're all set!"}</h2>
              <p className="text-muted-foreground">{isFr ? 'Votre espace est configuré. Commencez à gérer vos finances.' : 'Your workspace is set up. Start managing your finances.'}</p>
              <Button className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }} onClick={handleFinish}>
                {isFr ? 'Accéder au tableau de bord' : 'Go to Dashboard'} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Navigation */}
          {currentStep !== 'welcome' && currentStep !== 'done' && (
            <div className="flex justify-between mt-6">
              <Button variant="ghost" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-1" />{isFr ? 'Retour' : 'Back'}
              </Button>
              {/* On payment step, only allow next if paid or has trial */}
              {currentStep === 'payment' ? (
                <Button
                  className="text-primary-foreground"
                  style={{ background: 'var(--gradient-primary)' }}
                  onClick={handleNext}
                  disabled={!paymentConfirmed && !(selectedPlanData?.trial_days > 0)}
                >
                  {isFr ? 'Suivant' : 'Next'} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }} onClick={handleNext}>
                  {isFr ? 'Suivant' : 'Next'} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingPage;
