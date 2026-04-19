import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APP_URL = 'https://budgetplanner-pro.lovable.app';
const PRIMARY = '#6C3CF0';
const PRIMARY_GLOW = '#8B5CF6';
const ACCENT = '#22D3EE';
const FONT = "'Space Grotesk', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

function buildEmail(opts: { groupName: string; inviterName: string; acceptUrl: string; expiresAt: string }) {
  const expires = new Date(opts.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const safeGroup = String(opts.groupName).replace(/</g, '&lt;');
  const safeInviter = String(opts.inviterName).replace(/</g, '&lt;');

  return `<!DOCTYPE html><html lang="fr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>Invitation à rejoindre ${safeGroup}</title>
</head>
<body style="margin:0;padding:0;background:#EEF0F6;font-family:${FONT};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">

<!-- Hidden preheader -->
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#EEF0F6;">
  ${safeInviter} vous invite à rejoindre "${safeGroup}" sur Budget Planner — cliquez pour accepter.
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEF0F6;padding:40px 16px;">
  <tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border-radius:24px;overflow:hidden;box-shadow:0 12px 40px -12px rgba(108,60,240,0.22),0 4px 12px -4px rgba(15,23,42,0.06);">

      <!-- HERO -->
      <tr><td style="background:linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_GLOW} 60%, ${ACCENT} 130%);padding:44px 36px 38px;text-align:center;">
        <div style="display:inline-block;background:rgba(255,255,255,0.18);border:1px solid rgba(255,255,255,0.28);border-radius:999px;padding:6px 14px;color:#fff;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:24px;">
          👨‍👩‍👧 Invitation Famille
        </div>
        <div style="font-size:48px;line-height:1;margin-bottom:18px;">🎉</div>
        <h1 style="color:#fff;margin:0 0 10px;font-size:28px;font-weight:700;letter-spacing:-0.02em;line-height:1.2;">
          Vous êtes invité·e !
        </h1>
        <p style="color:rgba(255,255,255,0.85);margin:0;font-size:14px;line-height:1.5;">
          Rejoignez votre famille sur Budget Planner
        </p>
      </td></tr>

      <!-- BODY -->
      <tr><td style="padding:36px 36px 12px;">
        <p style="color:#0F172A;font-size:15px;line-height:1.65;margin:0 0 18px;">
          Bonjour 👋
        </p>
        <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 14px;">
          <strong style="color:#0F172A;">${safeInviter}</strong> vous invite à rejoindre le groupe familial
          <strong style="color:${PRIMARY};">« ${safeGroup} »</strong> sur Budget Planner.
        </p>
        <p style="color:#334155;font-size:15px;line-height:1.7;margin:0 0 28px;">
          Ensemble, vous pourrez partager des budgets, suivre les dépenses du foyer et atteindre vos objectifs financiers en équipe.
        </p>

        <!-- BIG CTA BUTTON (bulletproof) -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 24px;">
          <tr>
            <td align="center" bgcolor="${PRIMARY}" style="border-radius:14px;background:linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_GLOW});box-shadow:0 8px 24px -6px ${PRIMARY}66;">
              <a href="${opts.acceptUrl}"
                 target="_blank"
                 style="display:inline-block;padding:16px 38px;color:#FFFFFF;font-family:${FONT};font-size:15px;font-weight:700;letter-spacing:0.01em;text-decoration:none;border-radius:14px;mso-padding-alt:0;line-height:1;">
                ✨ Accepter l'invitation
              </a>
            </td>
          </tr>
        </table>

        <!-- Fallback link -->
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:14px 16px;margin:0 0 22px;">
          <p style="margin:0 0 6px;color:#64748B;font-size:11px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;">
            🔗 Lien direct
          </p>
          <a href="${opts.acceptUrl}" style="color:${PRIMARY};font-size:12px;line-height:1.5;text-decoration:underline;word-break:break-all;font-family:'SF Mono',Menlo,monospace;">
            ${opts.acceptUrl}
          </a>
        </div>

        <!-- Expiration notice -->
        <div style="background:linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%);border-radius:12px;padding:14px 16px;margin:0 0 8px;">
          <p style="margin:0;color:#78350F;font-size:12px;line-height:1.55;">
            ⏱️ Cette invitation expire le <strong>${expires}</strong>.<br>
            Si vous n'avez pas encore de compte, vous pourrez en créer un en un clic.
          </p>
        </div>
      </td></tr>

      <!-- FOOTER -->
      <tr><td style="padding:24px 36px 30px;text-align:center;">
        <p style="color:#94A3B8;font-size:11px;line-height:1.5;margin:0 0 14px;">
          Si vous ne souhaitez pas rejoindre ce groupe, ignorez simplement cet email.
        </p>
        <div style="height:1px;background:#E2E8F0;margin:0 0 16px;"></div>
        <p style="margin:0;color:#64748B;font-size:12px;line-height:1.5;">
          <strong style="color:#0F172A;">Budget Planner</strong> · Coach Financier
        </p>
        <p style="margin:4px 0 0;color:#94A3B8;font-size:11px;">
          © ${new Date().getFullYear()} · budget-planner-pro.eurekaci.dev
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured');

    // Authenticated client
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { groupId, email } = await req.json();
    if (!groupId || !email) return new Response(JSON.stringify({ error: 'groupId and email required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const cleanEmail = String(email).trim().toLowerCase();

    // Service-role client for inserts and lookups bypassing RLS quirks
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verify caller is owner
    const { data: group, error: groupErr } = await admin
      .from('family_groups')
      .select('id, name, owner_id')
      .eq('id', groupId)
      .single();
    if (groupErr || !group) throw new Error('Group not found');
    if (group.owner_id !== user.id) throw new Error('Only the owner can invite');

    // Insert invitation (DB unique index will block duplicates with status=pending)
    const { data: inv, error: invErr } = await admin
      .from('family_invitations')
      .insert({ group_id: groupId, invited_email: cleanEmail, invited_by: user.id })
      .select('id, token, expires_at')
      .single();
    if (invErr) {
      if (String(invErr.message).includes('family_invitations_unique_pending')) {
        throw new Error('Une invitation est déjà en attente pour cet email');
      }
      throw invErr;
    }

    // Inviter display name
    const { data: profile } = await admin.from('profiles').select('display_name').eq('user_id', user.id).maybeSingle();
    const inviterName = profile?.display_name || user.email || 'Un membre';

    const acceptUrl = `${APP_URL}/family/accept/${inv.token}`;
    const html = buildEmail({ groupName: group.name, inviterName, acceptUrl, expiresAt: inv.expires_at });

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Budget Planner <noreply@budget-planner-pro.eurekaci.dev>',
        to: [cleanEmail],
        subject: `👨‍👩‍👧 ${inviterName} vous invite dans "${group.name}"`,
        html,
      }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(`Resend error: ${JSON.stringify(result)}`);

    return new Response(JSON.stringify({ success: true, invitationId: inv.id, emailId: result.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('send-family-invitation error:', msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
