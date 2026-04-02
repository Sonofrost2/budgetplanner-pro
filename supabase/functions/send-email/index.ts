const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const PRIMARY_COLOR = '#6C3CF0';
const SECONDARY_COLOR = '#1DB883';
const FOREGROUND = '#151926';
const MUTED = '#6B7280';
const BG_COLOR = '#F4F5F7';
const BORDER_RADIUS = '16px';
const FONT_FAMILY = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const APP_NAME = 'Budget Planner';
const DOMAIN = 'budget-planner-pro.eurekaci.dev';
const APP_URL = 'https://budgetplanner-pro.lovable.app';

function wrapHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title}</title></head>
<body style="margin:0;padding:0;background:${BG_COLOR};font-family:${FONT_FAMILY};">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:${BORDER_RADIUS};overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,${PRIMARY_COLOR},#8B5CF6);padding:32px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">💰 ${APP_NAME}</h1>
    </div>
    <div style="padding:32px;">${body}</div>
    <div style="padding:20px 32px;background:#f9fafb;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="color:${MUTED};font-size:12px;margin:0;">© ${new Date().getFullYear()} ${APP_NAME} — Gérez vos finances intelligemment</p>
    </div>
  </div>
</body>
</html>`;
}

function makeButton(text: string, url: string): string {
  return `<div style="text-align:center;margin:28px 0;">
    <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,${PRIMARY_COLOR},#8B5CF6);color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:600;font-size:15px;">${text}</a>
  </div>`;
}

function greeting(name?: string): string {
  return `<p style="color:${FOREGROUND};font-size:16px;line-height:1.6;">Bonjour <strong>${name || 'cher utilisateur'}</strong>,</p>`;
}

// Email templates
const templates: Record<string, (data: Record<string, unknown>) => { subject: string; html: string }> = {
  // Auth: Email confirmation
  'confirm-signup': (data) => ({
    subject: '✉️ Confirmez votre compte — Budget Planner',
    html: wrapHtml('Confirmez votre compte', `
      ${greeting(data.displayName as string)}
      <p style="color:${FOREGROUND};font-size:16px;line-height:1.6;">Bienvenue sur ${APP_NAME} ! Confirmez votre adresse email pour commencer à gérer vos finances.</p>
      ${makeButton('Confirmer mon compte', data.confirmationUrl as string || `${APP_URL}/login`)}
      <p style="color:${MUTED};font-size:13px;text-align:center;">Si vous n'avez pas créé de compte, ignorez cet email.</p>
    `),
  }),

  // Auth: Password reset
  'reset-password': (data) => ({
    subject: '🔑 Réinitialisation de mot de passe — Budget Planner',
    html: wrapHtml('Réinitialisation de mot de passe', `
      ${greeting(data.displayName as string)}
      <p style="color:${FOREGROUND};font-size:16px;line-height:1.6;">Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.</p>
      ${makeButton('Réinitialiser le mot de passe', data.resetUrl as string || `${APP_URL}/reset-password`)}
      <p style="color:${MUTED};font-size:13px;text-align:center;">Ce lien expire dans 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email.</p>
    `),
  }),

  // Payment confirmation
  'payment-confirmation': (data) => {
    const formattedDate = (data.date as string) || new Date().toLocaleDateString('fr-FR');
    return {
      subject: '✅ Confirmation de paiement — Budget Planner',
      html: wrapHtml('Paiement confirmé', `
        ${greeting(data.displayName as string)}
        <p style="color:${FOREGROUND};font-size:16px;line-height:1.6;">Votre paiement pour le plan <strong>${data.planName || 'Premium'}</strong> a été traité avec succès.</p>
        <div style="background:#f9fafb;border-radius:12px;padding:20px;margin:24px 0;">
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:${MUTED};font-size:14px;">Plan</td><td style="padding:8px 0;text-align:right;font-weight:600;color:${FOREGROUND};">${data.planName || 'Premium'}</td></tr>
            <tr><td style="padding:8px 0;color:${MUTED};font-size:14px;">Montant</td><td style="padding:8px 0;text-align:right;font-weight:600;color:${FOREGROUND};">${data.amount} ${data.currency}</td></tr>
            <tr><td style="padding:8px 0;color:${MUTED};font-size:14px;">Date</td><td style="padding:8px 0;text-align:right;font-weight:600;color:${FOREGROUND};">${formattedDate}</td></tr>
            <tr><td style="padding:8px 0;color:${MUTED};font-size:14px;">Statut</td><td style="padding:8px 0;text-align:right;font-weight:600;color:${SECONDARY_COLOR};">✓ Confirmé</td></tr>
          </table>
        </div>
        ${makeButton('Accéder au tableau de bord', `${APP_URL}/dashboard`)}
        <p style="color:${MUTED};font-size:13px;text-align:center;">Merci de votre confiance !</p>
      `),
    };
  },

  // Onboarding welcome
  'welcome': (data) => ({
    subject: '🎉 Bienvenue sur Budget Planner !',
    html: wrapHtml('Bienvenue !', `
      ${greeting(data.displayName as string)}
      <p style="color:${FOREGROUND};font-size:16px;line-height:1.6;">Nous sommes ravis de vous accueillir sur ${APP_NAME} ! Votre compte est maintenant actif.</p>
      <div style="background:#f9fafb;border-radius:12px;padding:20px;margin:24px 0;">
        <p style="color:${FOREGROUND};font-size:15px;font-weight:600;margin:0 0 12px;">🚀 Par où commencer ?</p>
        <ul style="color:${FOREGROUND};font-size:14px;line-height:2;padding-left:20px;margin:0;">
          <li>Créez vos <strong>comptes</strong> (Espèces, Mobile Money, Banque...)</li>
          <li>Ajoutez vos premières <strong>transactions</strong></li>
          <li>Définissez vos <strong>budgets</strong> mensuels</li>
          <li>Configurez vos <strong>objectifs d'épargne</strong></li>
        </ul>
      </div>
      ${makeButton('Commencer maintenant', `${APP_URL}/dashboard`)}
    `),
  }),

  // Weekly summary
  'weekly-summary': (data) => ({
    subject: '📊 Votre bilan hebdomadaire — Budget Planner',
    html: wrapHtml('Bilan hebdomadaire', `
      ${greeting(data.displayName as string)}
      <p style="color:${FOREGROUND};font-size:16px;line-height:1.6;">Voici le résumé de votre semaine financière.</p>
      <div style="background:#f9fafb;border-radius:12px;padding:20px;margin:24px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:${MUTED};font-size:14px;">💰 Revenus</td><td style="padding:8px 0;text-align:right;font-weight:600;color:${SECONDARY_COLOR};">+${data.totalIncome || 0} ${data.currency || 'FCFA'}</td></tr>
          <tr><td style="padding:8px 0;color:${MUTED};font-size:14px;">💸 Dépenses</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#EF4444;">-${data.totalExpense || 0} ${data.currency || 'FCFA'}</td></tr>
          <tr style="border-top:1px solid #e5e7eb;"><td style="padding:12px 0 8px;color:${FOREGROUND};font-size:14px;font-weight:600;">📈 Solde net</td><td style="padding:12px 0 8px;text-align:right;font-weight:700;color:${FOREGROUND};">${data.netBalance || 0} ${data.currency || 'FCFA'}</td></tr>
        </table>
      </div>
      ${data.budgetAlerts ? `<p style="color:#EF4444;font-size:14px;">⚠️ ${data.budgetAlerts}</p>` : ''}
      ${makeButton('Voir les détails', `${APP_URL}/dashboard`)}
    `),
  }),

  // Budget alert
  'budget-alert': (data) => ({
    subject: `⚠️ Alerte budget : ${data.budgetName} — Budget Planner`,
    html: wrapHtml('Alerte de budget', `
      ${greeting(data.displayName as string)}
      <p style="color:${FOREGROUND};font-size:16px;line-height:1.6;">Votre budget <strong>${data.budgetName}</strong> a atteint <strong style="color:#EF4444;">${data.percentage}%</strong> de son plafond.</p>
      <div style="background:#f9fafb;border-radius:12px;padding:20px;margin:24px 0;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:${MUTED};font-size:14px;">Budget</td><td style="padding:8px 0;text-align:right;font-weight:600;color:${FOREGROUND};">${data.budgetName}</td></tr>
          <tr><td style="padding:8px 0;color:${MUTED};font-size:14px;">Dépensé</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#EF4444;">${data.spent} ${data.currency || 'FCFA'}</td></tr>
          <tr><td style="padding:8px 0;color:${MUTED};font-size:14px;">Plafond</td><td style="padding:8px 0;text-align:right;font-weight:600;color:${FOREGROUND};">${data.limit} ${data.currency || 'FCFA'}</td></tr>
        </table>
      </div>
      ${makeButton('Gérer mes budgets', `${APP_URL}/dashboard/budgets`)}
    `),
  }),
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');

    const { template, to, data } = await req.json();

    if (!template || !to) {
      return new Response(JSON.stringify({ error: 'template and to are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const templateFn = templates[template];
    if (!templateFn) {
      return new Response(JSON.stringify({ error: `Unknown template: ${template}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { subject, html } = templateFn(data || {});

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Budget Planner <noreply@${DOMAIN}>`,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      throw new Error(`Resend API error [${res.status}]: ${JSON.stringify(result)}`);
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('send-email error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
