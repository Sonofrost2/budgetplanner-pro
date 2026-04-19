// Compact "Usage du jour" card for FREE users so they see their remaining AI quota.
// Reads usage_counters directly (RLS allows users to read their own).

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

interface Props {
  userPlan: string | null;
}

// Mirror the limits set in requirePlan() calls
const FREE_LIMITS: Record<string, { label_fr: string; label_en: string; max: number }> = {
  ai_chat: { label_fr: 'Coach IA', label_en: 'AI Coach', max: 5 },
  ai_quick_parse: { label_fr: 'Saisie rapide IA', label_en: 'AI quick parse', max: 10 },
  ai_categorize: { label_fr: 'Catégorisation IA', label_en: 'AI categorize', max: 20 },
};

export const UsageTodayWidget = ({ userPlan }: Props) => {
  const { user } = useAuth();
  const { locale } = useLanguage();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const isFr = locale === 'fr';

  useEffect(() => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    supabase
      .from('usage_counters')
      .select('feature, count')
      .eq('user_id', user.id)
      .eq('day', today)
      .then(({ data }) => {
        const map: Record<string, number> = {};
        (data || []).forEach((r: any) => { map[r.feature] = r.count; });
        setCounts(map);
      });
  }, [user]);

  // Only show for free users
  if (userPlan && userPlan !== 'free') return null;

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/[0.04] to-transparent">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">{isFr ? 'Mon usage du jour' : "Today's usage"}</h3>
                <p className="text-[11px] text-muted-foreground">
                  {isFr ? 'Quotas plan Gratuit' : 'Free plan quotas'}
                </p>
              </div>
            </div>
            <Button asChild size="sm" variant="ghost" className="h-7 text-xs gap-1">
              <Link to="/dashboard/payment">
                <Sparkles className="w-3 h-3" />
                {isFr ? 'Pro' : 'Pro'}
              </Link>
            </Button>
          </div>

          <div className="space-y-2.5">
            {Object.entries(FREE_LIMITS).map(([feature, info]) => {
              const used = counts[feature] || 0;
              const pct = Math.min((used / info.max) * 100, 100);
              const exhausted = used >= info.max;
              return (
                <div key={feature}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium">
                      {isFr ? info.label_fr : info.label_en}
                    </span>
                    <span className={`text-[11px] tabular-nums ${exhausted ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                      {used} / {info.max}
                    </span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default UsageTodayWidget;
