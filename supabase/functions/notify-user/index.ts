/**
 * notify-user — Unified notification dispatcher
 *
 * Sends a notification to a user across the channels they enabled in
 * notification_preferences (push, email, SMS, WhatsApp).
 *
 * Designed to be invoked from other server-side functions (webhooks, crons)
 * using the service role key. Not exposed to clients directly.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

type Channel = 'push' | 'email' | 'sms' | 'whatsapp';

interface NotifyPayload {
  user_id: string;
  notification_type: string; // e.g. 'payment_receipt', 'subscription_expiry', 'budget_alert'
  title: string;
  body: string;
  channels?: Channel[]; // optional override; otherwise derived from prefs
  url?: string; // for push deep-link
  dedup_key?: string;
}

async function sendTwilio(
  endpoint: 'sms' | 'whatsapp',
  to: string,
  body: string,
) {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  if (!sid || !token) throw new Error('Twilio credentials missing');

  const fromSms = Deno.env.get('TWILIO_PHONE_NUMBER');
  const fromWhats = Deno.env.get('TWILIO_WHATSAPP_FROM') ||
    (fromSms ? `whatsapp:${fromSms}` : '');

  const To = endpoint === 'whatsapp'
    ? (to.startsWith('whatsapp:') ? to : `whatsapp:${to}`)
    : to;
  const From = endpoint === 'whatsapp' ? fromWhats : fromSms!;

  if (!From) throw new Error(`Twilio "from" not configured for ${endpoint}`);

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + btoa(`${sid}:${token}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To, From, Body: body }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Twilio ${endpoint}: ${data.message || res.status}`);
  return data.sid;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if (req.headers.get('Authorization') !== `Bearer ${serviceKey}`) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      serviceKey,
    );

    const payload = (await req.json()) as NotifyPayload;
    if (!payload.user_id || !payload.title || !payload.body) {
      return new Response(
        JSON.stringify({ error: 'user_id, title, body are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // 1) Load profile (phone) + prefs
    const [{ data: profile }, { data: prefs }, { data: authUser }] = await Promise.all([
      supabase.from('profiles')
        .select('phone, display_name')
        .eq('user_id', payload.user_id)
        .maybeSingle(),
      supabase.from('notification_preferences')
        .select('notify_via_sms, notify_via_whatsapp, notify_payment_receipts, notify_subscription_expiry, notify_payment_failure')
        .eq('user_id', payload.user_id)
        .maybeSingle(),
      supabase.auth.admin.getUserById(payload.user_id),
    ]);

    // 2) Resolve channels
    let channels: Channel[];
    if (payload.channels && payload.channels.length) {
      channels = payload.channels;
    } else {
      channels = ['push']; // push is always default
      if (prefs?.notify_via_sms) channels.push('sms');
      if (prefs?.notify_via_whatsapp) channels.push('whatsapp');
      // email is opt-in per type; for now we add it for transactional types
      if (
        ['payment_receipt', 'payment_failure', 'subscription_expiry'].includes(
          payload.notification_type,
        )
      ) {
        channels.push('email');
      }
    }

    // 3) Type-level prefs gate
    const typeAllowed = (() => {
      if (!prefs) return true;
      if (payload.notification_type === 'payment_receipt') return prefs.notify_payment_receipts !== false;
      if (payload.notification_type === 'payment_failure') return prefs.notify_payment_failure !== false;
      if (payload.notification_type === 'subscription_expiry') return prefs.notify_subscription_expiry !== false;
      return true;
    })();
    if (!typeAllowed) {
      return new Response(JSON.stringify({ skipped: 'type_disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const phone = profile?.phone?.trim();
    const email = authUser?.user?.email;
    const results: Record<string, unknown> = {};

    // 4) Dispatch
    await Promise.all(channels.map(async (ch) => {
      try {
        if (ch === 'push') {
          const r = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/push-notify`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                user_id: payload.user_id,
                title: payload.title,
                body: payload.body,
                data: { url: payload.url || '/dashboard' },
              }),
            },
          );
          results.push = await r.json().catch(() => ({ ok: r.ok }));
        } else if (ch === 'email' && email) {
          const r = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify({
                template: 'generic',
                to: email,
                data: { title: payload.title, body: payload.body, displayName: profile?.display_name || email },
              }),
            },
          );
          results.email = await r.json().catch(() => ({ ok: r.ok }));
        } else if ((ch === 'sms' || ch === 'whatsapp') && phone) {
          const sid = await sendTwilio(ch, phone, `${payload.title}\n\n${payload.body}`);
          results[ch] = { sid };
        } else {
          results[ch] = { skipped: 'no_destination' };
        }
      } catch (err) {
        results[ch] = { error: err instanceof Error ? err.message : String(err) };
      }
    }));

    // 5) History
    await supabase.from('notification_history').insert({
      user_id: payload.user_id,
      channel: channels.join(','),
      notification_type: payload.notification_type,
      title: payload.title,
      body: payload.body,
      dedup_key: payload.dedup_key ?? null,
    });

    return new Response(JSON.stringify({ success: true, channels, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('notify-user error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
