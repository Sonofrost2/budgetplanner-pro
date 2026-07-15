import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { useGeolocatedCurrency } from '@/hooks/useGeolocatedCurrency';
import { translateFeature } from '@/lib/planFeatures';
import { supabase } from '@/integrations/supabase/client';
import { DEFAULT_CURRENCY } from '@/lib/currency';
import type { Tables } from '@/integrations/supabase/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Sparkles, Wallet, Globe, CreditCard, ArrowRight, ArrowLeft, Plus, Trash2, Loader2, XCircle, Bell, Mail, MessageSquare, Smartphone, Target, PiggyBank, Timer } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

const STEPS = ['welcome', 'plan', 'preferences', 'notifications', 'accounts', 'goal', 'budget', 'payment', 'done'] as const;

const ACCOUNT_TYPES = [
  { value: 'mobile_money', label: '📱 Mobile Money' },
  { value: 'bank', label: '🏦 Banque' },
  { value: 'cash', label: '💵 Espèces' },
  { value: 'card', label: '💳 Carte' },
];

const GOAL_PRESETS = [
  { icon: '🛟', fr: "Fonds d'urgence", en: 'Emergency fund' },
  { icon: '✈️', fr: 'Voyage', en: 'Trip' },
  { icon: '🏠', fr: 'Logement', en: 'Home' },
  { icon: '🎓', fr: 'Éducation', en: 'Education' },
  { icon: '🚗', fr: 'Véhicule', en: 'Vehicle' },
  { icon: '💍', fr: 'Événement', en: 'Event' },
];

const OnboardingPage = () => {
  const { user, loading: authLoading } = useAuth();
  const { locale, setLocale } = useLanguage();
  const { formatPrice } = useGeolocatedCurrency();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [plans, setPlans] = useState<Tables<'subscription_plans'>[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('free');
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [lang, setLang] = useState(locale);
  const [phone, setPhone] = useState('');
  const [notifPush, setNotifPush] = useState(true);
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifSms, setNotifSms] = useState(false);
  const [notifWhatsapp, setNotifWhatsapp] = useState(false);
  const [accounts, setAccounts] = useState<{ name: string; type: string; icon: string; opening_balance: string }[]>([
    { name: '', type: 'mobile_money', icon: '📱', opening_balance: '0' },
  ]);
  // Goal & Budget quick-start
  const [goalName, setGoalName] = useState('');
  const [goalIcon, setGoalIcon] = useState('🎯');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalMonths, setGoalMonths] = useState('6');
  const [budgetCategoryId, setBudgetCategoryId] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetPeriod, setBudgetPeriod] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');
  const [expenseCategories, setExpenseCategories] = useState<{ id: string; name: string; icon: string | null }[]>([]);
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
    supabase
      .from('categories')
      .select('id, name, icon, type')
      .eq('user_id', user.id)
      .eq('type', 'expense')
      .order('name')
      .then(({ data }) => setExpenseCategories((data || []) as any));
  }, [user]);

  // Handle Paystack callback (?reference=...&paystack=1)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') || params.get('trxref');
    if (reference && params.get('paystack')) {
      setPaymentToken(reference);
      // Jump to payment step and auto-trigger verification
      const payIdx = STEPS.indexOf('payment');
      if (payIdx >= 0) setStep(payIdx);
      window.history.replaceState({}, '', '/onboarding');
      setTimeout(() => {
        // call verify after token is set in state
        handleVerifyPayment();
      }, 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('currency, locale, onboarding_completed, phone, sms_consent').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data?.onboarding_completed) { navigate('/dashboard'); return; }
        if (data?.currency) setCurrency(data.currency);
        if (data?.locale) setLang(data.locale as 'fr' | 'en');
        if (data?.phone) setPhone(data.phone);
        if (data?.sms_consent) {
          setNotifSms(true);
          setNotifWhatsapp(true);
        }
      });
  }, [user, navigate]);

  const addAccount = () => setAccounts(a => [...a, { name: '', type: 'mobile_money', icon: '📱', opening_balance: '0' }]);
  const removeAccount = (i: number) => setAccounts(a => a.filter((_, idx) => idx !== i));
  const updateAccount = (i: number, field: string, value: string) =>
    setAccounts(a => a.map((acc, idx) => idx === i ? { ...acc, [field]: value } : acc));

  const isPaidPlan = selectedPlan !== 'free';
  const selectedPlanData = plans.find(p => p.name === selectedPlan);

  const handlePayment = async () => {
    if (!selectedPlanData || !user) return;
    setPaymentLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('paystack-checkout', {
        body: {
          action: 'initialize',
          plan_id: selectedPlanData.id,
          annual: false,
          callback_url: window.location.origin + '/onboarding?paystack=1',
        },
      });
      if (error) throw error;
      if (data?.code === 'ALREADY_SUBSCRIBED') {
        toast.info(isFr ? 'Vous etes deja abonne a ce plan.' : 'You are already subscribed to this plan.');
        setPaymentLoading(false);
        return;
      }
      if (data?.status && data?.data?.authorization_url) {
        const reference = data.data.reference || '';
        setPaymentToken(reference);
        window.open(data.data.authorization_url, '_blank');
        toast.info(isFr
          ? "Finalisez le paiement dans l'onglet ouvert, puis cliquez sur Vérifier."
          : 'Complete payment in the opened tab, then click Verify.');
      } else {
        toast.error(data?.message || (isFr ? 'Erreur lors du paiement' : 'Payment error'));
      }
    } catch (err: any) {
      toast.error(err.message || 'Error');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleVerifyPayment = async () => {
    if (!paymentToken || !user) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('paystack-checkout', {
        body: { action: 'verify', reference: paymentToken },
      });
      if (error) throw error;
      if (data?.status && data?.data?.status === 'success') {
        setPaymentConfirmed(true);
        const price = formatPrice((selectedPlanData?.currency_prices || {}) as Record<string, number>);

        // Subscription + receipt are activated server-side by paystack-checkout
        // (verify action), gated by Paystack signature + matching user_id.

        toast.success(isFr ? 'Paiement confirmé !' : 'Payment confirmed!');

        // Send confirmation email
        const { data: profile } = await supabase.from('profiles').select('display_name').eq('user_id', user.id).single();
        supabase.functions.invoke('send-email', {
          body: {
            template: 'payment-confirmation',
            to: user.email,
            data: {
              displayName: profile?.display_name || user.email,
              planName: selectedPlan,
              amount: price.amount,
              currency: price.currency || currency,
            },
          },
        }).catch(err => console.error('Payment email error:', err));
      } else {
        toast.warning(isFr
          ? `Statut : ${data?.data?.status || 'en attente'}`
          : `Status: ${data?.data?.status || 'pending'}`);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleFinish = async () => {
    if (!user) return;
    const trimmedPhone = phone.trim();
    const phoneValid = !trimmedPhone || /^\+\d{8,15}$/.test(trimmedPhone);
    if (!phoneValid) {
      toast.error(isFr ? 'Numéro invalide. Format : +XXX...' : 'Invalid number. Format: +XXX...');
      return;
    }
    await supabase
      .from('profiles')
      .update({
        currency,
        locale: lang,
        onboarding_completed: true,
        phone: trimmedPhone || null,
      })
      .eq('user_id', user.id);

    // Persist notification channel preferences
    const coachChannels = [
      notifPush ? 'push' : null,
      notifEmail ? 'email' : null,
      notifSms && trimmedPhone ? 'sms' : null,
      notifWhatsapp && trimmedPhone ? 'whatsapp' : null,
    ].filter(Boolean) as string[];
    await supabase
      .from('notification_preferences')
      .upsert(
        {
          user_id: user.id,
          notify_via_sms: notifSms && !!trimmedPhone,
          notify_via_whatsapp: notifWhatsapp && !!trimmedPhone,
          coach_channels: coachChannels.length > 0 ? coachChannels : ['push', 'email'],
        },
        { onConflict: 'user_id' },
      );
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

    // Optional: first savings goal
    const targetAmt = Number(goalTarget);
    const months = Math.max(1, Number(goalMonths) || 6);
    if (goalName.trim() && targetAmt > 0) {
      const deadline = new Date();
      deadline.setMonth(deadline.getMonth() + months);
      await supabase.from('savings_goals').insert({
        user_id: user.id,
        name: goalName.trim(),
        icon: goalIcon || '🎯',
        target_amount: targetAmt,
        current_amount: 0,
        deadline: deadline.toISOString().slice(0, 10),
        monthly_contribution: Math.round(targetAmt / months),
        priority: 'high',
      } as any);
    }

    // Optional: first budget
    const budgetAmt = Number(budgetAmount);
    if (budgetCategoryId && budgetAmt > 0) {
      const cat = expenseCategories.find(c => c.id === budgetCategoryId);
      await supabase.from('budgets').insert({
        user_id: user.id,
        name: cat?.name || (isFr ? 'Mon premier budget' : 'My first budget'),
        amount: budgetAmt,
        category_id: budgetCategoryId,
        period: budgetPeriod,
        alert_threshold: 80,
        budget_type: 'expense',
        control_type: 'limit',
        priority: 'medium',
        is_renewable: true,
      } as any);
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
                {[...plans].sort((a, b) => {
                  const order: Record<string, number> = { free: 0, pro: 1, premium: 2 };
                  return (order[a.name] ?? 99) - (order[b.name] ?? 99);
                }).map(plan => {
                  const price = formatPrice((plan.currency_prices || {}) as Record<string, number>);
                  const isSelected = selectedPlan === plan.name;
                  const planLabel =
                    plan.name === 'free' ? (isFr ? 'Gratuit' : 'Free')
                    : plan.name === 'pro' ? 'Pro'
                    : plan.name === 'premium' ? 'Premium'
                    : plan.name.charAt(0).toUpperCase() + plan.name.slice(1);
                  return (
                    <button key={plan.id} onClick={() => setSelectedPlan(plan.name)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{planLabel}</p>
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
                        {(Array.isArray(plan.features) ? plan.features : []).map((f: unknown, i: number) => (
                          <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded-full">{translateFeature(String(f), isFr ? 'fr' : 'en')}</span>
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

          {currentStep === 'notifications' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold font-display flex items-center gap-2">
                  <Bell className="w-5 h-5 text-primary" />
                  {isFr ? 'Vos canaux de notification' : 'Your notification channels'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {isFr
                    ? 'Choisissez comment votre Coach Financier vous contacte. Modifiable à tout moment.'
                    : 'Choose how your Financial Coach reaches you. Editable anytime.'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="onb-phone">{isFr ? 'Téléphone (optionnel)' : 'Phone (optional)'}</Label>
                <Input
                  id="onb-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+225 07 08 09 09 10"
                />
                <p className="text-[11px] text-muted-foreground">
                  {isFr
                    ? 'Format international (+225...). Requis pour SMS et WhatsApp.'
                    : 'International format (+225...). Required for SMS and WhatsApp.'}
                </p>
              </div>

              <div className="space-y-2">
                <ChannelRow
                  icon={Bell}
                  title={isFr ? 'Notifications push' : 'Push notifications'}
                  desc={isFr ? 'Alertes en temps réel sur ce navigateur / mobile' : 'Real-time alerts in this browser / mobile'}
                  checked={notifPush}
                  onChange={setNotifPush}
                />
                <ChannelRow
                  icon={Mail}
                  title="Email"
                  desc={isFr ? 'Résumés et alertes importantes' : 'Digests and important alerts'}
                  checked={notifEmail}
                  onChange={setNotifEmail}
                />
                <ChannelRow
                  icon={Smartphone}
                  title="SMS"
                  desc={isFr ? 'Alertes critiques (échéances, gros mouvements)' : 'Critical alerts (deadlines, large moves)'}
                  checked={notifSms && !!phone.trim()}
                  onChange={setNotifSms}
                  disabled={!phone.trim()}
                  disabledHint={isFr ? 'Renseignez un numéro pour activer' : 'Add a phone number to enable'}
                />
                <ChannelRow
                  icon={MessageSquare}
                  title="WhatsApp"
                  desc={isFr ? 'Reçus de paiement et confirmations' : 'Payment receipts and confirmations'}
                  checked={notifWhatsapp && !!phone.trim()}
                  onChange={setNotifWhatsapp}
                  disabled={!phone.trim()}
                  disabledHint={isFr ? 'Renseignez un numéro pour activer' : 'Add a phone number to enable'}
                />
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
                      <Button aria-label="Supprimer" variant="ghost" size="icon" className="h-10 w-10 text-destructive" onClick={() => removeAccount(i)}>
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
                      <p className="font-bold text-lg">{formatPrice((selectedPlanData.currency_prices || {}) as Record<string, number>).formatted}</p>
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

const ChannelRow = ({
  icon: Icon,
  title,
  desc,
  checked,
  onChange,
  disabled,
  disabledHint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  disabledHint?: string;
}) => (
  <label
    className={`flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${
      disabled ? 'opacity-60 cursor-not-allowed border-border/40' : checked ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/30'
    }`}
  >
    <Checkbox
      checked={checked}
      onCheckedChange={(v) => onChange(v === true)}
      disabled={disabled}
      className="mt-0.5"
    />
    <Icon className="w-4 h-4 mt-0.5 text-primary shrink-0" />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium leading-tight">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      {disabled && disabledHint && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">{disabledHint}</p>
      )}
    </div>
  </label>
);
