/**
 * subscription-expiry-reminder
 *
 * Daily cron — sends reminders to users whose subscription expires in
 * 7 days, 1 day, or today (J-7, J-1, J0). Uses notify-user so each
 * recipient gets the alert through the channels they enabled
 * (push, email, SMS, WhatsApp).
 *
 * Deduplication via notification_history (dedup_key = `expiry:<sub_id>:<bucket>`).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

type Bucket = 'j7' | 'j1' | 'j0';

function bucketFor(daysLeft: number): Bucket | null {
  if (daysLeft <= 0) return 'j0';
  if (daysLeft === 1) return 'j1';
  if (daysLeft === 7) return 'j7';
  return null;
}

function copy(bucket: Bucket, planName: string) {
  if (bucket === 'j0') {
    return {
      title: `⏰ Abonnement ${planName} — expire aujourd'hui`,
      body: `Votre abonnement ${planName} expire aujourd'hui. Renouvelez maintenant pour ne pas perdre l'accès Premium.`,
    };
  }
  if (bucket === 'j1') {
    return {
      title: `⏳ Abonnement ${planName} — expire demain`,
      body: `Votre abonnement ${planName} expire demain. Pensez à le renouveler pour garder un accès continu.`,
    };
  }
  return {
    title: `📅 Abonnement ${planName} — expire dans 7 jours`,
    body: `Votre abonnement ${planName} expire dans une semaine. Renouvelez-le quand vous voulez depuis vos paramètres.`,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Look 7 days ahead — covers j-7, j-1, j-0
    const horizon = new Date();
    horizon.setUTCHours(23, 59, 59, 999);
    horizon.setUTCDate(horizon.getUTCDate() + 7);

    const { data: subs, error } = await supabase
      .from('subscriptions')
      .select('id, user_id, current_period_end, subscription_plans(name)')
      .in('status', ['active', 'trialing'])
      .lte('current_period_end', horizon.toISOString());

    if (error) throw error;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const results: unknown[] = [];

    for (const sub of subs || []) {
      const end = new Date(sub.current_period_end);
      const daysLeft = Math.ceil((end.getTime() - today.getTime()) / 86400000);
      const bucket = bucketFor(daysLeft);
      if (!bucket) continue;

      const dedupKey = `expiry:${sub.id}:${bucket}`;

      // Skip if already sent today bucket
      const { data: existing } = await supabase
        .from('notification_history')
        .select('id')
        .eq('user_id', sub.user_id)
        .eq('dedup_key', dedupKey)
        .limit(1);

      if (existing && existing.length > 0) {
        results.push({ sub_id: sub.id, bucket, status: 'already_sent' });
        continue;
      }

      const planName =
        (sub.subscription_plans as { name?: string } | null)?.name ?? 'Pro';
      const { title, body } = copy(bucket, planName);

      const r = await fetch(`${SUPABASE_URL}/functions/v1/notify-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          user_id: sub.user_id,
          notification_type: 'subscription_expiry',
          title,
          body,
          url: '/dashboard/settings',
          dedup_key: dedupKey,
        }),
      });

      results.push({
        sub_id: sub.id,
        bucket,
        status: r.ok ? 'sent' : 'failed',
        http: r.status,
      });
    }

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('subscription-expiry-reminder error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
