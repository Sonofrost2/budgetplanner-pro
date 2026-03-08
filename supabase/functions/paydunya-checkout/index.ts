const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const MASTER_KEY = Deno.env.get('PAYDUNYA_MASTER_KEY')!;
    const PRIVATE_KEY = Deno.env.get('PAYDUNYA_PRIVATE_KEY')!;
    const TOKEN = Deno.env.get('PAYDUNYA_TOKEN')!;

    const { action, amount, description, callback_url, return_url, cancel_url, token } = await req.json();

    if (action === 'create') {
      // Create checkout invoice
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
            description: description || 'Paiement BudgetPlanner Pro',
          },
          store: {
            name: 'BudgetPlanner Pro',
            tagline: 'Gérez vos finances facilement',
            website_url: return_url || 'https://budgetplanner-pro.lovable.app',
          },
          actions: {
            callback_url: callback_url || '',
            return_url: return_url || 'https://budgetplanner-pro.lovable.app/dashboard',
            cancel_url: cancel_url || 'https://budgetplanner-pro.lovable.app/dashboard/payment',
          },
        }),
      });

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'verify') {
      // Verify payment status
      const res = await fetch(`https://app.paydunya.com/api/v1/checkout-invoice/confirm/${token}`, {
        headers: {
          'PAYDUNYA-MASTER-KEY': MASTER_KEY,
          'PAYDUNYA-PRIVATE-KEY': PRIVATE_KEY,
          'PAYDUNYA-TOKEN': TOKEN,
        },
      });

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
