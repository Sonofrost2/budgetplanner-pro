import { useState, useEffect, useCallback } from 'react';
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
import { CheckCircle2, Sparkles, Wallet, Globe, CreditCard, ArrowRight, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const STEPS = ['welcome', 'plan', 'preferences', 'accounts', 'done'] as const;

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
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('free');
  const [currency, setCurrency] = useState('EUR');
  const [lang, setLang] = useState(locale);
  const [accounts, setAccounts] = useState<{ name: string; type: string; icon: string; opening_balance: string }[]>([
    { name: '', type: 'mobile_money', icon: '📱', opening_balance: '0' },
  ]);

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

  const handleFinish = async () => {
    if (!user) return;
    // Save preferences
    await supabase.from('profiles').update({ currency, locale: lang, onboarding_completed: true }).eq('user_id', user.id);
    setLocale(lang as 'fr' | 'en');
    // Save accounts
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
    toast.success(locale === 'fr' ? 'Configuration terminée !' : 'Setup complete!');
    navigate('/dashboard');
  };

  const isFr = lang === 'fr';
  const currentStep = STEPS[step];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" style={{ backgroundImage: 'var(--gradient-hero)' }}>
      <Card className="w-full max-w-lg border-none shadow-[var(--shadow-elevated)]">
        <CardContent className="p-8">
          {/* Progress */}
          <div className="flex gap-1 mb-8">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>

          {currentStep === 'welcome' && (
            <div className="text-center space-y-4">
              <Sparkles className="w-12 h-12 text-primary mx-auto" />
              <h2 className="text-2xl font-bold font-display">{isFr ? 'Bienvenue sur BudgetPlan !' : 'Welcome to BudgetPlan!'}</h2>
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
              <Button variant="ghost" onClick={() => setStep(s => s - 1)}>
                <ArrowLeft className="w-4 h-4 mr-1" />{isFr ? 'Retour' : 'Back'}
              </Button>
              <Button className="text-primary-foreground" style={{ background: 'var(--gradient-primary)' }} onClick={() => setStep(s => s + 1)}>
                {isFr ? 'Suivant' : 'Next'} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OnboardingPage;
