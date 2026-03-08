const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY');
    if (!BREVO_API_KEY) throw new Error('BREVO_API_KEY is not configured');

    const { email, displayName, planName, amount, currency, date } = await req.json();

    if (!email) throw new Error('Email is required');

    const isFr = true; // Default to French for this app
    const formattedDate = date || new Date().toLocaleDateString('fr-FR');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#6366F1,#8B5CF6);padding:32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:24px;">✅ Paiement confirmé</h1>
    </div>
    <div style="padding:32px;">
      <p style="color:#374151;font-size:16px;line-height:1.6;">
        Bonjour <strong>${displayName || 'cher utilisateur'}</strong>,
      </p>
      <p style="color:#374151;font-size:16px;line-height:1.6;">
        Votre paiement pour le plan <strong>${planName || 'Premium'}</strong> a été traité avec succès.
      </p>
      <div style="background:#f9fafb;border-radius:8px;padding:20px;margin:24px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-size:14px;">Plan</td>
            <td style="padding:8px 0;text-align:right;font-weight:600;color:#111827;">${planName || 'Premium'}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-size:14px;">Montant</td>
            <td style="padding:8px 0;text-align:right;font-weight:600;color:#111827;">${amount} ${currency}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-size:14px;">Date</td>
            <td style="padding:8px 0;text-align:right;font-weight:600;color:#111827;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;color:#6b7280;font-size:14px;">Statut</td>
            <td style="padding:8px 0;text-align:right;font-weight:600;color:#10b981;">✓ Confirmé</td>
          </tr>
        </table>
      </div>
      <div style="text-align:center;margin:24px 0;">
        <a href="https://budgetplanner-pro.lovable.app/dashboard" style="display:inline-block;background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;">
          Accéder au tableau de bord
        </a>
      </div>
      <p style="color:#9ca3af;font-size:13px;text-align:center;margin-top:24px;">
        Merci de votre confiance !<br>L'équipe Budget Planner
      </p>
    </div>
  </div>
</body>
</html>`;

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Budget Planner', email: 'garmelcedric@gmail.com' },
        to: [{ email, name: displayName || email }],
        subject: '✅ Confirmation de paiement - Budget Planner',
        htmlContent,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(`Brevo API error [${res.status}]: ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify({ success: true, messageId: data.messageId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('send-payment-confirmation error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
