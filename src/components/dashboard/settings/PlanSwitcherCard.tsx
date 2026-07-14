import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { useSubscription, type PlanTier } from '@/hooks/useSubscription';
import { useLanguage } from '@/i18n/LanguageContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Beaker, Loader2, ShieldCheck, RotateCcw } from 'lucide-react';
import { ADMIN_TEST_PLAN_KEY, ADMIN_TEST_PLAN_EVENT } from '@/hooks/useSubscription';

/**
 * Admin-only QA card to switch the current user's active subscription
 * between Free / Pro / Premium without leaving the app.
 */
export const PlanSwitcherCard = () => {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useRole();
  const { planTier, refresh } = useSubscription();
  const { locale } = useLanguage();
  const isFr = locale === 'fr';
  const qc = useQueryClient();

  const [busy, setBusy] = useState<PlanTier | null>(null);

  if (roleLoading || !isAdmin) return null;

  const switchTo = async (target: PlanTier) => {
    if (!user) return;
    setBusy(target);
    try {
      // Session-only override: NEVER touches the real subscription or billing.
      // Cleared on tab close (sessionStorage).
      sessionStorage.setItem(ADMIN_TEST_PLAN_KEY, target);
      window.dispatchEvent(new CustomEvent(ADMIN_TEST_PLAN_EVENT));
      await qc.invalidateQueries();
      refresh();
      toast.success(isFr ? `Test QA : plan ${target} (session)` : `QA test: plan ${target} (session)`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const clearOverride = async () => {
    sessionStorage.removeItem(ADMIN_TEST_PLAN_KEY);
    window.dispatchEvent(new CustomEvent(ADMIN_TEST_PLAN_EVENT));
    await qc.invalidateQueries();
    refresh();
    toast.success(isFr ? 'Override QA levé — plan réel restauré' : 'QA override cleared — real plan restored');
  };

  const hasOverride = typeof window !== 'undefined' && !!sessionStorage.getItem(ADMIN_TEST_PLAN_KEY);

  const tiers: { key: PlanTier; label: string; tone: string }[] = [
    { key: 'free', label: 'Free', tone: 'bg-muted text-foreground' },
    { key: 'pro', label: 'Pro', tone: 'bg-secondary text-secondary-foreground' },
    { key: 'premium', label: 'Premium', tone: 'bg-primary text-primary-foreground' },
  ];

  return (
    <Card className="border border-warning/40 rounded-2xl glass">
      <CardContent className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-border/40">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-warning/15 text-warning">
            <Beaker className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-base">{isFr ? 'Tester comme…' : 'Test as…'}</h2>
              <Badge variant="outline" className="text-[9px] uppercase tracking-wider gap-1 border-warning/40 text-warning">
                <ShieldCheck className="w-3 h-3" /> {isFr ? 'Admin / QA' : 'Admin / QA'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isFr
                ? 'Override QA en session uniquement — n\'impacte ni l\'abonnement réel ni la facturation.'
                : 'Session-only QA override — never touches the real subscription or billing.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">{isFr ? 'Plan actuel' : 'Current'} :</span>
          <Badge className="capitalize">{planTier}</Badge>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {tiers.map(t => {
            const isCurrent = planTier === t.key;
            return (
              <Button
                key={t.key}
                variant={isCurrent ? 'default' : 'outline'}
                size="sm"
                disabled={busy !== null || isCurrent}
                onClick={() => switchTo(t.key)}
                className="rounded-xl h-10 font-semibold"
              >
                {busy === t.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t.label}
              </Button>
            );
          })}
        </div>
        {hasOverride && (
          <Button variant="ghost" size="sm" onClick={clearOverride} className="w-full gap-2 text-xs">
            <RotateCcw className="w-3.5 h-3.5" />
            {isFr ? 'Revenir au plan réel' : 'Restore real plan'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default PlanSwitcherCard;
