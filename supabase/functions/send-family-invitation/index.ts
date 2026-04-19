import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const APP_URL = 'https://budgetplanner-pro.lovable.app';
const PRIMARY = '#6C3CF0';
const PRIMARY_GLOW = '#8B5CF6';
const FONT = "'Space Grotesk', 'Inter', -apple-system, sans-serif";

function buildEmail(opts: { groupName: string; inviterName: string; acceptUrl: string; expiresAt: string }) {
  const expires = new Date(opts.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invitation famille</title></head>
<body style="margin:0;padding:0;background:#F4F5F8;font-family:${FONT};-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F8;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px -8px rgba(108,60,240,0.18);">
        <tr><td style="background:linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_GLOW} 100%);padding:40px 32px 32px;">
          <div style="display:inline-block;background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.24);border-radius:999px;padding:6px 14px;color:#fff;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:20px;">👨‍👩‍👧 Famille</div>
          <div style="font-size:40px;line-height:1;margin-bottom:14px;">🎉</div>
          <h1 style="color:#fff;margin:0;font-size:26px;font-weight:700;letter-spacing:-0.02em;line-height:1.2;">Vous êtes invité·e !</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#0F172A;font-size:16px;font-weight:600;margin:0 0 18px;">Bonjour 👋</p>
          <p style="color:#0F172A;font-size:15px;line-height:1.65;margin:0 0 14px;"><strong>${opts.inviterName}</strong> vous invite à rejoindre le groupe familial <strong>"${opts.groupName}"</strong> sur Budget Planner.</p>
          <p style="color:#0F172A;font-size:15px;line-height:1.65;margin:0 0 14px;">Ensemble, vous pourrez partager des budgets, suivre les dépenses du foyer et atteindre vos objectifs financiers en équipe.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;"><tr><td>
            <a href="${opts.acceptUrl}" style="display:inline-block;background:linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_GLOW});color:#fff;text-decoration:none;padding:14px 32px;border-radius:14px;font-weight:600;font-size:14px;box-shadow:0 4px 16px -4px ${PRIMARY}66;">Accepter l'invitation →</a>
          </td></tr></table>
          <div style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:14px;padding:14px 16px;margin:16px 0;">
            <p style="margin:0;color:#64748B;font-size:12px;line-height:1.5;">⏱️ Cette invitation expire le <strong style="color:#0F172A;">${expires}</strong>. Si vous n'avez pas de compte, vous pourrez en créer un en cliquant sur le lien.</p>
          </div>
          <p style="color:#94A3B8;font-size:12px;line-height:1.5;margin:18px 0 0;text-align:center;">Si vous ne souhaitez pas rejoindre ce groupe, ignorez simplement cet email.</p>
        </td></tr>
        <tr><td style="padding:24px 32px 28px;background:#F9FAFB;border-top:1px solid #E5E7EB;font-size:12px;color:#64748B;">
          <strong style="color:#0F172A;">Budget Planner</strong> — Coach Financier<br>
          <span style="color:#94A3B8;">© ${new Date().getFullYear()} • budget-planner-pro.eurekaci.dev</span>
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
