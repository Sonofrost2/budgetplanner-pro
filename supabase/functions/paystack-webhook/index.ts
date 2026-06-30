import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { reportError } from '../_shared/sentry.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!PAYSTACK_SECRET_KEY) {
      console.error('PAYSTACK_SECRET_KEY not configured');
      return new Response('Server error', { status: 500 });
    }

    // 1. Verify Paystack signature
    const body = await req.text();
    const signature = req.headers.get('x-paystack-signature');

    if (!signature) {
      console.error('Missing x-paystack-signature header');
      return new Response('Invalid signature', { status: 401 });
    }

    const hash = createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(body)
      .digest('hex');

    // Constant-time comparison (anti timing-attack)
    let signatureValid = false;
    try {
      const a = Buffer.from(hash, 'hex');
      const b = Buffer.from(signature, 'hex');
      signatureValid = a.length === b.length && timingSafeEqual(a, b);
    } catch (_) {
      signatureValid = false;
    }
    if (!signatureValid) {
      console.error('Signature mismatch');
      return new Response('Invalid signature', { status: 401 });
    }

    // 2. Parse event
    const event = JSON.parse(body);
    console.log('Paystack webhook event:', event.event, event.data?.reference);

    // Service-role client used by every branch below
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 3a. Refunds & disputes — revoke access
    if (event.event === 'refund.processed' || event.event === 'charge.dispute.create') {
      const reference =
        event.data?.transaction_reference ||
        event.data?.transaction?.reference ||
        event.data?.reference;
      if (!reference) {
        console.error('Refund/dispute event missing transaction reference');
        return new Response(JSON.stringify({ received: true, skipped: 'no_reference' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const reason =
        event.event === 'charge.dispute.create'
          ? `dispute:${event.data?.category || event.data?.reason || 'unknown'}`
          : `refund:${event.data?.reason || event.data?.merchant_note || 'processed'}`;
      const { data: refundResult, error: refundErr } = await supabase.rpc(
        'process_paystack_refund',
        { p_payment_token: reference, p_reason: reason }
      );
      if (refundErr) {
        console.error('process_paystack_refund error:', refundErr);
        throw refundErr;
      }
      console.log('Refund/dispute applied:', event.event, reference, refundResult);
      return new Response(JSON.stringify({ received: true, refund: refundResult }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3b. Only handle charge.success past this point
    if (event.event !== 'charge.success') {
      return new Response(JSON.stringify({ received: true, skipped: event.event }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const txData = event.data;
    const reference = txData.reference;
    const metadata = txData.metadata || {};
    const planId = metadata.plan_id;
    const userId = metadata.user_id;
    const planName = metadata.plan_name;

    if (!reference || !userId) {
      console.error('Missing reference or user_id in webhook data');
      return new Response(JSON.stringify({ error: 'Missing data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Defense-in-depth: re-verify the transaction directly with Paystack
    // before trusting the payload (mitigates risk if signing key ever leaks).
    try {
      const verifyRes = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } },
      );
      const verifyJson = await verifyRes.json();
      const status = verifyJson?.data?.status;
      const verifiedAmount = verifyJson?.data?.amount;
      const verifiedCurrency = verifyJson?.data?.currency;
      if (!verifyJson?.status || status !== 'success') {
        console.error('Re-verify failed', status, verifyJson?.message);
        return new Response('Verification failed', { status: 400 });
      }
      // Cross-check amount/currency with the webhook payload
      if (
        Number(verifiedAmount) !== Number(txData.amount) ||
        String(verifiedCurrency) !== String(txData.currency)
      ) {
        console.error('Amount/currency mismatch between webhook and verify');
        return new Response('Amount mismatch', { status: 400 });
      }
    } catch (e) {
      console.error('Re-verify exception:', e);
      return new Response('Verification error', { status: 500 });
    }

    // 5. Find and activate the pending subscription
    const { data: pendingSubs, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'renewal_pending'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (subError) {
      console.error('DB error finding subscription:', subError);
      throw subError;
    }

    const now = new Date().toISOString();
    const isAnnual = !!metadata.annual;
    const periodDays = isAnnual ? 365 : 30;
    const billingCycle = isAnnual ? 'annual' : 'monthly';
    const periodEnd = new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000).toISOString();

    if (pendingSubs && pendingSubs.length > 0) {
      const sub = pendingSubs[0];
      const isRenewal = sub.status === 'renewal_pending' || metadata.renewal;

      await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          current_period_start: now,
          current_period_end: periodEnd,
          last_payment_token: reference,
          plan_id: planId || sub.plan_id,
          billing_cycle: billingCycle,
        })
        .eq('id', sub.id);

      console.log(`Subscription ${sub.id} activated (${isRenewal ? 'renewal' : 'new'})`);
    } else {
      // Create new subscription if none found pending
      await supabase.from('subscriptions').insert({
        user_id: userId,
        plan_id: planId,
        status: 'active',
        payment_method: 'paystack',
        current_period_start: now,
        current_period_end: periodEnd,
        last_payment_token: reference,
        billing_cycle: billingCycle,
      });
      console.log('New subscription created for user', userId);
    }

    // 6. Confirm payment receipt
    const { error: receiptError } = await supabase
      .from('payment_receipts')
      .update({ status: 'confirmed' })
      .eq('payment_token', reference)
      .eq('user_id', userId);

    if (receiptError) {
      console.error('Receipt update error:', receiptError);
    }

    // 7. Send confirmation email + SMS/WhatsApp via notify-user
    try {
      const { data: { user: authUser } } = await supabase.auth.admin.getUserById(userId);
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', userId)
        .single();

      const displayName = profile?.display_name || authUser?.email || '';
      const amountFmt = `${(txData.amount || 0).toLocaleString('fr-FR')} ${txData.currency || 'XOF'}`;
      const planLabel = planName || 'Pro';

      // Multi-channel notification (push + email + SMS/WhatsApp if enabled)
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/notify-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          user_id: userId,
          notification_type: 'payment_receipt',
          title: `✅ Paiement confirmé — ${planLabel}`,
          body: `Bonjour ${displayName}, votre paiement de ${amountFmt} pour le plan ${planLabel} a été confirmé. Merci !`,
          url: '/dashboard/settings',
          dedup_key: `paystack:${reference}`,
        }),
      });

      // Keep the dedicated email template for richer formatting
      if (authUser?.email) {
        await supabase.functions.invoke('send-email', {
          body: {
            template: 'payment-confirmation',
            to: authUser.email,
            data: {
              displayName,
              planName: planLabel,
              amount: txData.amount,
              currency: txData.currency || 'XOF',
            },
          },
        });
      }
    } catch (emailErr) {
      console.error('Notification error (non-blocking):', emailErr);
    }

    return new Response(JSON.stringify({ received: true, status: 'confirmed' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Webhook error:', err);
    await reportError(err, { function_name: 'paystack-webhook' });
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
