import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// Currencies natively supported by our Paystack account
const PAYSTACK_NATIVE = ['XOF', 'XAF', 'NGN', 'GHS', 'KES', 'ZAR', 'USD'];
const TO_XOF: Record<string, number> = {
  EUR: 655.957, XOF: 1, XAF: 1, GBP: 760, CHF: 700, CAD: 480, USD: 600,
  NGN: 0.4, GHS: 50, KES: 4.5, ZAR: 35,
};

function resolveServerPrice(displayAmount: number, displayCurrency: string) {
  const cur = (displayCurrency || 'XOF').toUpperCase();
  if (PAYSTACK_NATIVE.includes(cur)) {
    return { amount: displayAmount, currency: cur };
  }
  const rate = TO_XOF[cur] ?? TO_XOF.EUR;
  return { amount: Math.round(displayAmount * rate), currency: 'XOF' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!PAYSTACK_SECRET_KEY) {
      console.error('PAYSTACK_SECRET_KEY missing');
      return json({ status: false, message: 'Server misconfigured' }, 500);
    }

    // ---- AUTH ----
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) return json({ status: false, message: 'Unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json({ status: false, message: 'Unauthorized' }, 401);
    }
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const { action } = body || {};

    // =========================================================
    // INITIALIZE: server is the source of truth for the price
    // =========================================================
    if (action === 'initialize') {
      const planId: string | undefined = body.plan_id;
      const annual: boolean = !!body.annual;
      const callbackUrl: string | undefined = body.callback_url;
      if (!planId) return json({ status: false, message: 'plan_id required' }, 400);

      // 1) Block duplicate active plan
      const { data: activeSub } = await supabase
        .from('subscriptions')
        .select('id, plan_id, status, current_period_end')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .gt('current_period_end', new Date().toISOString())
        .maybeSingle();

      if (activeSub && activeSub.plan_id === planId) {
        return json({
          status: false,
          code: 'ALREADY_SUBSCRIBED',
          message: 'Vous etes deja abonne a ce plan.',
          current_period_end: activeSub.current_period_end,
        }, 409);
      }

      // 2) Load plan from DB (source of truth for price)
      const { data: plan, error: planErr } = await supabase
        .from('subscription_plans')
        .select('id, name, base_price, currency_prices, active')
        .eq('id', planId)
        .eq('active', true)
        .maybeSingle();
      if (planErr || !plan) return json({ status: false, message: 'Plan not found' }, 404);
      if (plan.name === 'free') return json({ status: false, message: 'Free plan does not require payment' }, 400);

      // 3) Determine user currency from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('currency')
        .eq('user_id', user.id)
        .maybeSingle();
      const userCurrency = (profile?.currency || 'XOF').toUpperCase();
      const prices = (plan.currency_prices || {}) as Record<string, number>;
      const monthly = prices[userCurrency] ?? Number(plan.base_price);
      const displayAmount = annual ? Math.round(monthly * 12 * 0.8) : monthly;

      // 4) Convert to a Paystack-supported currency if needed
      const resolved = resolveServerPrice(displayAmount, userCurrency);
      const cur = resolved.currency.toUpperCase();
      const isCfa = cur === 'XOF' || cur === 'XAF';
      const baseAmount = isCfa ? Math.round(resolved.amount) : resolved.amount;
      const paystackAmount = Math.round(baseAmount * 100);

      // 5) Reuse a fresh pending subscription (< 1h) to avoid spam duplicates
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: existingPending } = await supabase
        .from('subscriptions')
        .select('id, last_payment_token, plan_id')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .eq('plan_id', planId)
        .gte('created_at', oneHourAgo)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // 6) Initialize transaction with Paystack
      const psRes = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
        body: JSON.stringify({
          email: user.email,
          amount: paystackAmount,
          currency: resolved.currency,
          callback_url: callbackUrl,
          metadata: {
            plan_id: plan.id,
            plan_name: plan.name,
            user_id: user.id,
            annual,
            display_amount: displayAmount,
            display_currency: userCurrency,
          },
        }),
      });
      const data = await psRes.json();
      if (!data?.status || !data?.data?.authorization_url) {
        return json({ status: false, message: data?.message || 'Paystack init failed' }, 502);
      }
      const reference = data.data.reference;

      // 7) Persist pending records server-side (auth'd by service role, fields are sanitized)
      if (existingPending) {
        await supabase.from('subscriptions')
          .update({ last_payment_token: reference })
          .eq('id', existingPending.id);
      } else {
        await supabase.from('subscriptions').insert({
          user_id: user.id,
          plan_id: plan.id,
          status: 'pending',
          payment_method: 'paystack',
          last_payment_token: reference,
        });
      }
      await supabase.from('payment_receipts').insert({
        user_id: user.id,
        plan_name: plan.name,
        amount: resolved.amount,
        currency: resolved.currency,
        payment_token: reference,
        status: 'pending',
      });

      return json(data);
    }

    // =========================================================
    // VERIFY
    // =========================================================
    if (action === 'verify') {
      const reference: string | undefined = body.reference;
      if (!reference) return json({ status: false, message: 'Reference is required' }, 400);

      const psRes = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        { headers: { 'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}` } },
      );
      const data = await psRes.json();

      // Only activate the subscription/receipt server-side when Paystack confirms
      // success AND the transaction belongs to the authenticated caller.
      if (data?.status && data?.data?.status === 'success') {
        const metaUserId = data?.data?.metadata?.user_id;
        if (metaUserId && metaUserId !== user.id) {
          return json({ status: false, message: 'Reference does not belong to caller' }, 403);
        }
        const isAnnual = !!data?.data?.metadata?.annual;
        const periodDays = isAnnual ? 365 : 30;
        const billingCycle = isAnnual ? 'annual' : 'monthly';
        try {
          await supabase.rpc('activate_paid_subscription', {
            p_user_id: user.id,
            p_reference: reference,
            p_period_days: periodDays,
            p_billing_cycle: billingCycle,
          });
        } catch (e) {
          console.error('activate_paid_subscription failed:', e);
        }
      }
      return json(data);
    }

    return json({ status: false, message: 'Invalid action. Use "initialize" or "verify".' }, 400);
  } catch (err: any) {
    console.error('paystack-checkout error:', err);
    return json({ status: false, message: err?.message || 'Server error' }, 500);
  }
});
