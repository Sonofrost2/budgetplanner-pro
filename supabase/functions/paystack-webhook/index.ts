import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'node:crypto';

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

    if (hash !== signature) {
      console.error('Signature mismatch');
      return new Response('Invalid signature', { status: 401 });
    }

    // 2. Parse event
    const event = JSON.parse(body);
    console.log('Paystack webhook event:', event.event, event.data?.reference);

    // 3. Only handle charge.success
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

    // 4. Use service role to update DB
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

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
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
