const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!PAYSTACK_SECRET_KEY) {
      throw new Error('PAYSTACK_SECRET_KEY is not configured');
    }

      const { action, amount, email, currency, description, callback_url, metadata, reference } = await req.json();

    if (action === 'initialize') {
      // Paystack expects amounts in the lowest denomination (kobo/pesewa/cent).
      // For ALL currencies including XOF/XAF, multiply by 100.
      // XOF/XAF have no decimals, so we must round the input first to avoid
      // Paystack rejecting fractional amounts ("No decimal places allowed").
      const cur = (currency || 'XOF').toUpperCase();
      const isCfa = cur === 'XOF' || cur === 'XAF';
      const baseAmount = isCfa ? Math.round(amount) : amount;
      const paystackAmount = Math.round(baseAmount * 100);

      const res = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
        body: JSON.stringify({
          email,
          amount: paystackAmount,
          currency: currency || 'XOF',
          callback_url,
          metadata: {
            ...metadata,
            description: description || 'Abonnement Budget Planner Pro',
          },
        }),
      });

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'verify') {
      // Verify a transaction
      if (!reference) {
        return new Response(JSON.stringify({ status: false, message: 'Reference is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      });

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ status: false, message: 'Invalid action. Use "initialize" or "verify".' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ status: false, message: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
