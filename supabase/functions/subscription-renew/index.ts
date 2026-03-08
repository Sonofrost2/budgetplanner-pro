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
    const MASTER_KEY = Deno.env.get('PAYDUNYA_MASTER_KEY')!;
    const PRIVATE_KEY = Deno.env.get('PAYDUNYA_PRIVATE_KEY')!;
    const TOKEN = Deno.env.get('PAYDUNYA_TOKEN')!;

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

      const prices = (plan.currency_prices || {}) as Record<string, number>;
      // Default to XOF price or base_price
      const amount = prices['XOF'] || plan.base_price;

      // Create PayDunya invoice for renewal
      const res = await fetch('https://app.paydunya.com/api/v1/checkout-invoice/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'PAYDUNYA-MASTER-KEY': MASTER_KEY,
          'PAYDUNYA-PRIVATE-KEY': PRIVATE_KEY,
          'PAYDUNYA-TOKEN': TOKEN,
        },
        body: JSON.stringify({
          invoice: {
            total_amount: amount,
            description: `Renouvellement abonnement ${plan.name} - Budget Planner Pro`,
          },
          store: {
            name: 'Budget Planner Pro',
            tagline: 'Renouvellement automatique',
            website_url: 'https://budgetplanner-pro.lovable.app',
          },
          actions: {
            callback_url: `${SUPABASE_URL}/functions/v1/subscription-renew-callback`,
            return_url: 'https://budgetplanner-pro.lovable.app/dashboard/payment?success=true',
            cancel_url: 'https://budgetplanner-pro.lovable.app/dashboard/payment',
          },
        }),
      });

      const payData = await res.json();

      if (payData?.response_code === '00') {
        // Update subscription with pending renewal token
        await supabase.from('subscriptions').update({
          last_payment_token: payData.token,
          status: 'renewal_pending',
        }).eq('id', sub.id);

        // Create receipt
        await supabase.from('payment_receipts').insert({
          user_id: sub.user_id,
          plan_name: plan.name,
          amount,
          currency: 'XOF',
          status: 'pending',
          payment_token: payData.token,
        });

        results.push({ sub_id: sub.id, status: 'renewal_initiated', token: payData.token });
      } else {
        // Mark as past_due if renewal fails
        await supabase.from('subscriptions').update({
          status: 'past_due',
        }).eq('id', sub.id);

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
