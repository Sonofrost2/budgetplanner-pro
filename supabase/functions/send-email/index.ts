const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ─── Refonte design system ─────────────────────────────────────────
// Dark-aware palette inspired by Space Grotesk + glassmorphism brand
const PRIMARY = '#6C3CF0';
const PRIMARY_GLOW = '#8B5CF6';
const ACCENT = '#1DB883';
const DANGER = '#EF4444';
const WARN = '#F59E0B';
const FOREGROUND = '#0F172A';
const MUTED = '#64748B';
const SUBTLE = '#94A3B8';
const BG = '#F4F5F8';
const SURFACE = '#FFFFFF';
const SURFACE_2 = '#F9FAFB';
const BORDER = '#E5E7EB';
const RADIUS_LG = '20px';
const RADIUS_MD = '14px';
const RADIUS_SM = '10px';
const FONT = "'Space Grotesk', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const APP_NAME = 'Budget Planner';
const TAGLINE = 'Coach Financier';
const DOMAIN = 'budget-planner-pro.eurekaci.dev';
const APP_URL = 'https://budgetplanner-pro.lovable.app';

type AccentVariant = 'primary' | 'success' | 'warning' | 'danger';

function accentColor(v: AccentVariant): string {
  switch (v) {
    case 'success': return ACCENT;
    case 'warning': return WARN;
    case 'danger': return DANGER;
    default: return PRIMARY;
  }
}

function wrapHtml(opts: { title: string; preheader?: string; heroEmoji: string; heroLabel: string; accent?: AccentVariant; body: string }): string {
  const { title, preheader = '', heroEmoji, heroLabel, accent = 'primary', body } = opts;
  const accentHex = accentColor(accent);
  const heroGradient = accent === 'primary'
    ? `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_GLOW} 100%)`
    : `linear-gradient(135deg, ${accentHex} 0%, ${PRIMARY_GLOW} 140%)`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:${FONT};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${BG};">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 16px;">
    <tr><td align="center">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${SURFACE};border-radius:${RADIUS_LG};overflow:hidden;box-shadow:0 8px 32px -8px rgba(108,60,240,0.18),0 2px 8px rgba(15,23,42,0.04);">

        <!-- Hero -->
        <tr><td style="background:${heroGradient};padding:40px 32px 32px;text-align:left;">
          <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.16);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,0.24);border-radius:999px;padding:6px 14px;color:#fff;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:20px;">
            <span>💎</span><span>${TAGLINE}</span>
          </div>
          <div style="font-size:40px;line-height:1;margin-bottom:14px;">${heroEmoji}</div>
          <h1 style="color:#fff;margin:0;font-size:26px;font-weight:700;letter-spacing:-0.02em;line-height:1.2;">${heroLabel}</h1>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">${body}</td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 32px 28px;background:${SURFACE_2};border-top:1px solid ${BORDER};">
          <table width="100%" role="presentation"><tr>
            <td style="font-size:12px;color:${MUTED};">
              <strong style="color:${FOREGROUND};">${APP_NAME}</strong> — ${TAGLINE}<br>
              <span style="color:${SUBTLE};">© ${new Date().getFullYear()} • Gérez vos finances intelligemment</span>
            </td>
            <td align="right" style="font-size:11px;">
              <a href="${APP_URL}/dashboard/settings" style="color:${MUTED};text-decoration:none;">Préférences</a>
              <span style="color:${BORDER};margin:0 6px;">·</span>
              <a href="${APP_URL}" style="color:${MUTED};text-decoration:none;">${DOMAIN}</a>
            </td>
          </tr></table>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function makeButton(text: string, url: string, accent: AccentVariant = 'primary'): string {
  const c = accentColor(accent);
  const grad = accent === 'primary'
    ? `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_GLOW})`
    : `linear-gradient(135deg, ${c}, ${PRIMARY_GLOW})`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;"><tr><td>
    <a href="${url}" style="display:inline-block;background:${grad};color:#fff;text-decoration:none;padding:14px 32px;border-radius:${RADIUS_MD};font-weight:600;font-size:14px;letter-spacing:0.01em;box-shadow:0 4px 16px -4px ${c}66;">
      ${text} →
    </a>
  </td></tr></table>`;
}

function paragraph(text: string): string {
  return `<p style="color:${FOREGROUND};font-size:15px;line-height:1.65;margin:0 0 14px;">${text}</p>`;
}

function muted(text: string): string {
  return `<p style="color:${MUTED};font-size:13px;line-height:1.5;margin:18px 0 0;text-align:center;">${text}</p>`;
}

function greeting(name?: string): string {
  return `<p style="color:${FOREGROUND};font-size:16px;font-weight:600;line-height:1.5;margin:0 0 18px;">Bonjour ${name ? name : 'cher utilisateur'} 👋</p>`;
}

function statCard(rows: { label: string; value: string; valueColor?: string }[]): string {
  const tr = rows.map((r, i) => `
    <tr>
      <td style="padding:${i === 0 ? '0' : '10px'} 0 10px;color:${MUTED};font-size:13px;${i > 0 ? `border-top:1px solid ${BORDER};` : ''}">${r.label}</td>
      <td style="padding:${i === 0 ? '0' : '10px'} 0 10px;text-align:right;font-weight:700;font-size:14px;color:${r.valueColor || FOREGROUND};${i > 0 ? `border-top:1px solid ${BORDER};` : ''}">${r.value}</td>
    </tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SURFACE_2};border:1px solid ${BORDER};border-radius:${RADIUS_MD};padding:18px 20px;margin:20px 0;">${tr}</table>`;
}

function checklist(items: string[]): string {
  const lis = items.map(i => `
    <tr><td style="padding:8px 0;">
      <table role="presentation"><tr>
        <td style="padding-right:12px;vertical-align:top;"><span style="display:inline-block;width:22px;height:22px;background:${PRIMARY}15;color:${PRIMARY};border-radius:50%;text-align:center;font-size:12px;line-height:22px;font-weight:700;">✓</span></td>
        <td style="color:${FOREGROUND};font-size:14px;line-height:1.5;">${i}</td>
      </tr></table>
    </td></tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">${lis}</table>`;
}

// ─── Templates ───────────────────────────────────────────────────────
const templates: Record<string, (data: Record<string, unknown>) => { subject: string; html: string }> = {

  'generic': (data) => ({
    subject: String(data.subject || data.title || 'Notification — Budget Planner'),
    html: data.html
      ? String(data.html)
      : wrapHtml({
          title: String(data.title || 'Notification'),
          heroEmoji: '📬',
          heroLabel: String(data.title || 'Notification'),
          accent: 'primary',
          body: `${greeting(data.displayName as string)}${paragraph(String(data.body || ''))}`,
        }),
  }),

  'confirm-signup': (data) => ({
    subject: '✉️ Confirmez votre compte — Budget Planner',
    html: wrapHtml({
      title: 'Confirmez votre compte',
      preheader: 'Un dernier clic pour activer votre Coach Financier.',
      heroEmoji: '✉️',
      heroLabel: 'Confirmez votre compte',
      accent: 'primary',
      body: `
        ${greeting(data.displayName as string)}
        ${paragraph(`Bienvenue dans <strong>${APP_NAME}</strong> ! Confirmez votre adresse email pour débloquer toutes les fonctionnalités de votre Coach Financier.`)}
        ${makeButton('Confirmer mon compte', (data.confirmationUrl as string) || `${APP_URL}/login`)}
        ${muted(`Si vous n'avez pas créé de compte, ignorez simplement cet email.`)}
      `,
    }),
  }),

  'reset-password': (data) => ({
    subject: '🔑 Réinitialisation de mot de passe — Budget Planner',
    html: wrapHtml({
      title: 'Réinitialisation',
      preheader: 'Choisissez un nouveau mot de passe en un clic.',
      heroEmoji: '🔑',
      heroLabel: 'Nouveau mot de passe',
      accent: 'primary',
      body: `
        ${greeting(data.displayName as string)}
        ${paragraph(`Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.`)}
        ${makeButton('Réinitialiser le mot de passe', (data.resetUrl as string) || `${APP_URL}/reset-password`)}
        ${muted(`⏱️ Ce lien expire dans 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email.`)}
      `,
    }),
  }),

  'payment-confirmation': (data) => {
    const formattedDate = (data.date as string) || new Date().toLocaleDateString('fr-FR');
    return {
      subject: '✅ Paiement confirmé — Budget Planner',
      html: wrapHtml({
        title: 'Paiement confirmé',
        preheader: `Votre plan ${data.planName || 'Premium'} est actif.`,
        heroEmoji: '✅',
        heroLabel: 'Paiement confirmé',
        accent: 'success',
        body: `
          ${greeting(data.displayName as string)}
          ${paragraph(`Votre paiement pour le plan <strong>${data.planName || 'Premium'}</strong> a été traité avec succès. Bienvenue dans la nouvelle dimension de la gestion financière 🚀`)}
          ${statCard([
            { label: 'Plan', value: String(data.planName || 'Premium') },
            { label: 'Montant', value: `${data.amount} ${data.currency}` },
            { label: 'Date', value: formattedDate },
            { label: 'Statut', value: '✓ Confirmé', valueColor: ACCENT },
          ])}
          ${makeButton('Accéder au tableau de bord', `${APP_URL}/dashboard`, 'success')}
          ${muted('Merci de votre confiance — votre Coach est prêt à travailler avec vous.')}
        `,
      }),
    };
  },

  'welcome': (data) => ({
    subject: '🎉 Bienvenue sur Budget Planner !',
    html: wrapHtml({
      title: 'Bienvenue !',
      preheader: 'Voici par où commencer pour reprendre le contrôle de vos finances.',
      heroEmoji: '🎉',
      heroLabel: `Bienvenue ${data.displayName ? (data.displayName as string).split(' ')[0] : ''} !`,
      accent: 'primary',
      body: `
        ${paragraph(`Nous sommes ravis de vous accueillir sur <strong>${APP_NAME}</strong>. Votre compte est actif et votre <strong>Coach Financier</strong> vous accompagne dès maintenant.`)}
        <h3 style="color:${FOREGROUND};font-size:15px;font-weight:700;margin:24px 0 8px;">🚀 Votre démarrage en 4 étapes</h3>
        ${checklist([
          'Créez vos <strong>comptes</strong> (Espèces, Mobile Money, Banque…)',
          'Ajoutez vos premières <strong>transactions</strong>',
          'Définissez vos <strong>budgets</strong> mensuels',
          'Configurez vos <strong>objectifs d\'épargne</strong>',
        ])}
        ${makeButton('Commencer maintenant', `${APP_URL}/dashboard`)}
      `,
    }),
  }),

  'weekly-summary': (data) => {
    const isPositive = String(data.netBalance || '').replace(/[^0-9.-]/g, '').startsWith('-') === false;
    return {
      subject: '📊 Votre bilan hebdomadaire — Budget Planner',
      html: wrapHtml({
        title: 'Bilan hebdomadaire',
        preheader: 'Votre semaine financière en un coup d\'œil.',
        heroEmoji: '📊',
        heroLabel: 'Votre bilan hebdomadaire',
        accent: isPositive ? 'success' : 'warning',
        body: `
          ${greeting(data.displayName as string)}
          ${paragraph(`Voici le résumé de votre semaine financière. ${isPositive ? 'Vous êtes sur la bonne voie 💪' : 'Quelques ajustements peuvent aider 🧭'}`)}
          ${statCard([
            { label: '💰 Revenus', value: `+${data.totalIncome || 0} ${data.currency || 'FCFA'}`, valueColor: ACCENT },
            { label: '💸 Dépenses', value: `−${data.totalExpense || 0} ${data.currency || 'FCFA'}`, valueColor: DANGER },
            { label: '📈 Solde net', value: `${data.netBalance || 0} ${data.currency || 'FCFA'}`, valueColor: isPositive ? ACCENT : DANGER },
          ])}
          ${data.budgetAlerts ? `<div style="background:${WARN}10;border-left:3px solid ${WARN};border-radius:${RADIUS_SM};padding:12px 14px;margin:16px 0;color:${FOREGROUND};font-size:13px;line-height:1.5;">⚠️ ${data.budgetAlerts}</div>` : ''}
          ${makeButton('Voir les détails', `${APP_URL}/dashboard`, isPositive ? 'success' : 'warning')}
        `,
      }),
    };
  },

  'budget-alert': (data) => {
    const pct = Number(data.percentage || 0);
    const variant: AccentVariant = pct >= 100 ? 'danger' : 'warning';
    return {
      subject: `⚠️ Alerte budget : ${data.budgetName} — Budget Planner`,
      html: wrapHtml({
        title: 'Alerte de budget',
        preheader: `${data.budgetName} : ${pct}% atteint.`,
        heroEmoji: pct >= 100 ? '🚨' : '⚠️',
        heroLabel: pct >= 100 ? 'Budget dépassé' : 'Alerte de budget',
        accent: variant,
        body: `
          ${greeting(data.displayName as string)}
          ${paragraph(`Votre budget <strong>${data.budgetName}</strong> a atteint <strong style="color:${variant === 'danger' ? DANGER : WARN};">${pct}%</strong> de son plafond. ${pct >= 100 ? 'Il est temps de freiner 🛑' : 'Anticipez la fin de période 🧭'}`)}
          ${statCard([
            { label: 'Budget', value: String(data.budgetName) },
            { label: 'Dépensé', value: `${data.spent} ${data.currency || 'FCFA'}`, valueColor: variant === 'danger' ? DANGER : WARN },
            { label: 'Plafond', value: `${data.limit} ${data.currency || 'FCFA'}` },
            { label: 'Progression', value: `${pct}%`, valueColor: variant === 'danger' ? DANGER : WARN },
          ])}
          ${makeButton('Gérer mes budgets', `${APP_URL}/dashboard/budgets`, variant)}
          ${muted('💡 Astuce : ajustez votre seuil d\'alerte ou activez les heures silencieuses dans les paramètres.')}
        `,
      }),
    };
  },
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
