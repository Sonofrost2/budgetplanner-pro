import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY')!;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Find active subscriptions that are due for renewal (period ended)
    const now = new Date().toISOString();
    const { data: expiredSubs, error } = await supabase
      .from('subscriptions')
      .select('*, subscription_plans(*)')
      .eq('status', 'active')
      .lt('current_period_end', now);

    if (error) throw error;

    const results: any[] = [];

    for (const sub of (expiredSubs || [])) {
      const plan = sub.subscription_plans;
      if (!plan) continue;

      // Get user email for Paystack
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', sub.user_id)
        .single();

      // Get user email from auth
      const { data: { user: authUser } } = await supabase.auth.admin.getUserById(sub.user_id);
      const email = authUser?.email;
      if (!email) {
        results.push({ sub_id: sub.id, status: 'skipped', reason: 'no_email' });
        continue;
      }

      const prices = (plan.currency_prices || {}) as Record<string, number>;
      const amount = prices['XOF'] || plan.base_price;

      // Initialize Paystack transaction for renewal
      const res = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
        body: JSON.stringify({
          email,
          amount: amount, // XOF is already in smallest unit
          currency: 'XOF',
          callback_url: `https://budgetplanner-pro.lovable.app/dashboard/payment?success=true&plan=${plan.id}`,
          metadata: {
            plan_id: plan.id,
            plan_name: plan.name,
            user_id: sub.user_id,
            renewal: true,
          },
        }),
      });

      const payData = await res.json();

      if (payData?.status && payData?.data?.reference) {
        // Update subscription with pending renewal reference
        await supabase.from('subscriptions').update({
          last_payment_token: payData.data.reference,
          status: 'renewal_pending',
        }).eq('id', sub.id);

        // Create receipt
        await supabase.from('payment_receipts').insert({
          user_id: sub.user_id,
          plan_name: plan.name,
          amount,
          currency: 'XOF',
          status: 'pending',
          payment_token: payData.data.reference,
        });

        results.push({ sub_id: sub.id, status: 'renewal_initiated', reference: payData.data.reference });
      } else {
        // Mark as past_due if renewal fails
        await supabase.from('subscriptions').update({
          status: 'past_due',
        }).eq('id', sub.id);

        // Notify user about failed renewal (push + SMS/WhatsApp/email per prefs)
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/notify-user`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              user_id: sub.user_id,
              notification_type: 'payment_failure',
              title: `⚠️ Échec de renouvellement — ${plan.name}`,
              body: `Votre paiement pour le plan ${plan.name} n'a pas pu être traité. Veuillez mettre à jour votre moyen de paiement pour continuer à profiter de votre abonnement.`,
              url: '/dashboard/settings',
              dedup_key: `renewal_failed:${sub.id}:${new Date().toISOString().slice(0,10)}`,
            }),
          });
        } catch (notifyErr) {
          console.error('notify-user error (non-blocking):', notifyErr);
        }

        results.push({ sub_id: sub.id, status: 'renewal_failed', error: payData });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
