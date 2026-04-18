// Weekly job: notify users before auto-archiving emptied savings goals
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Find emptied completed goals (current < 5% of target)
  const { data: goals, error } = await supabase
    .from('savings_goals')
    .select('id, user_id, name, icon, current_amount, target_amount, updated_at')
    .eq('status', 'completed')
    .is('deleted_at', null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const emptied = (goals ?? []).filter(
    (g) => g.target_amount > 0 && g.current_amount < g.target_amount * 0.05
  );

  let notified = 0;
  let archived = 0;

  for (const goal of emptied) {
    const dedupKey = `savings_archive_warning_${goal.id}`;

    // Check if user was already warned 7+ days ago
    const { data: history } = await supabase
      .from('notification_history')
      .select('id, sent_at')
      .eq('user_id', goal.user_id)
      .eq('dedup_key', dedupKey)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const warnedAt = history?.sent_at ? new Date(history.sent_at) : null;
    const warnedLongAgo = warnedAt && warnedAt.toISOString() < sevenDaysAgo;

    if (warnedLongAgo) {
      // 2nd pass: archive
      await supabase.from('savings_goals').update({ status: 'archived' }).eq('id', goal.id);
      await supabase.from('notification_history').insert({
        user_id: goal.user_id,
        notification_type: 'savings_archived',
        title: `📦 Objectif archivé : ${goal.name}`,
        body: `${goal.icon} "${goal.name}" a été archivé automatiquement après 7 jours d'inactivité.`,
        channel: 'push',
        reference_id: goal.id,
        dedup_key: `savings_archived_${goal.id}_${Date.now()}`,
      });

      await fetch(`${SUPABASE_URL}/functions/v1/push-notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({
          user_id: goal.user_id,
          title: `📦 ${goal.name} archivé`,
          body: `Cet objectif vidé a été archivé automatiquement.`,
          data: { url: '/dashboard/savings' },
        }),
      }).catch(() => {});
      archived++;
      continue;
    }

    if (warnedAt) continue; // Already warned, waiting grace period

    // 1st pass: warn
    const { error: insErr } = await supabase.from('notification_history').insert({
      user_id: goal.user_id,
      notification_type: 'savings_archive_warning',
      title: `⚠️ ${goal.name} sera archivé`,
      body: `${goal.icon} "${goal.name}" est vidé. Sera archivé dans 7 jours sans action.`,
      channel: 'push',
      reference_id: goal.id,
      dedup_key: dedupKey,
    });
    if (insErr) continue;

    await fetch(`${SUPABASE_URL}/functions/v1/push-notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({
        user_id: goal.user_id,
        title: `⚠️ ${goal.name} sera archivé`,
        body: `Cet objectif est vidé. Archivage auto dans 7 jours.`,
        data: { url: '/dashboard/savings' },
      }),
    }).catch(() => {});
    notified++;
  }

  return new Response(
    JSON.stringify({ checked: emptied.length, notified, archived }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
