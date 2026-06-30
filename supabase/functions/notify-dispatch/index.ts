// Central notification dispatcher — single entry point for ALL alerts.
// Handles channel selection, per-channel quotas, quiet-hours deferral,
// dedup, and history logging in one place.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Channel = "push" | "email" | "sms" | "whatsapp";

interface DispatchRequest {
  user_id: string;
  notification_type: string;
  title: string;
  body: string;
  dedup_key?: string;
  reference_id?: string;
  channels?: Channel[];      // override; otherwise derived from prefs
  critical?: boolean;        // bypass quiet-hours deferral
  data?: Record<string, unknown>;
  url?: string;
}

/**
 * Classify a notification_type as 'factual' (event-driven, must reach user
 * close to the action) vs 'reminder' (periodic/proactive, can be batched
 * into a digest without losing value).
 */
function classifyType(notificationType: string): 'factual' | 'reminder' {
  const t = notificationType.toLowerCase();
  // Factual = reacts to something the user just did or that just happened
  const factualPrefixes = [
    'large_transaction', 'balance_discrepancy', 'goal_reached',
    'low_balance', 'savings_contribution', 'payment_receipt',
    'payment_failure', 'budget_breach', 'transfer_completed',
  ];
  if (factualPrefixes.some(p => t.startsWith(p))) return 'factual';
  // Everything else (deadlines, projections, reminders, digests, weekly
  // summary, status alerts) is treated as a reminder.
  return 'reminder';
}

/** Compute the next scheduled time for a given digest slot (morning/evening). */
function nextDigestTime(prefs: any, slot: 'morning' | 'evening', now: Date): Date {
  const hour = slot === 'morning'
    ? Number(prefs?.morning_digest_hour ?? 7)
    : Number(prefs?.evening_digest_hour ?? 19);
  const next = new Date(now);
  next.setUTCHours(hour, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function defer_until(prefs: any, now: Date): Date {
  const end = Number(prefs?.quiet_hours_end ?? 7);
  const next = new Date(now);
  next.setUTCHours(end, 5, 0, 0); // +5min cushion
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // Internal-only: require service-role bearer token
    if (req.headers.get("Authorization") !== `Bearer ${serviceKey}`) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(supabaseUrl, serviceKey);
    const body = await req.json() as DispatchRequest;
    const {
      user_id, notification_type, title,
      body: msgBody, dedup_key, reference_id, critical,
      channels: forcedChannels, data = {}, url,
    } = body;

    if (!user_id || !notification_type || !title) {
      return new Response(JSON.stringify({ error: "missing_fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: prefs } = await supabase
      .from("notification_preferences").select("*").eq("user_id", user_id).maybeSingle();
    if (!prefs) {
      return new Response(JSON.stringify({ skipped: "no_prefs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Derive channels: explicit override > coach_channels pref > push only
    let channels: Channel[] = forcedChannels && forcedChannels.length
      ? forcedChannels
      : (prefs.coach_channels && prefs.coach_channels.length
          ? prefs.coach_channels as Channel[]
          : ["push"]);
    // Filter by user-enabled SMS/WhatsApp opt-ins
    if (!prefs.notify_via_sms) channels = channels.filter(c => c !== "sms");
    if (!prefs.notify_via_whatsapp) channels = channels.filter(c => c !== "whatsapp");

    const results: Record<string, unknown> = {};
    const now = new Date();

    // === Delivery-mode routing ===
    // Factual alerts → factual_delivery_mode (default 'immediate')
    // Reminder alerts → reminder_delivery_mode (default 'morning')
    // Critical bypasses everything (e.g. payment failure can override).
    const family = classifyType(notification_type);
    const mode = family === 'factual'
      ? (prefs.factual_delivery_mode || 'immediate')
      : (prefs.reminder_delivery_mode || 'morning');

    if (!critical && mode !== 'immediate') {
      // Schedule into the next requested digest slot(s), one queue row per channel
      const slots: Array<'morning' | 'evening'> =
        mode === 'both' ? ['morning', 'evening'] : [mode as 'morning' | 'evening'];
      for (const channel of channels) {
        for (const slot of slots) {
          await supabase.from("notification_queue").insert({
            user_id, notification_type, channel, title,
            body: msgBody, dedup_key, reference_id,
            payload: { data, url, digest_slot: slot, family },
            scheduled_for: nextDigestTime(prefs, slot, now).toISOString(),
            status: "pending",
          } as any).select().single().then(() => {}, () => {});
        }
        results[channel] = `digest:${slots.join('+')}`;
      }
      return new Response(JSON.stringify({ ok: true, results, routed: 'digest' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const channel of channels) {
      // Pre-flight check via SQL helper
      const { data: check } = await supabase.rpc("should_send_notification", {
        p_user_id: user_id,
        p_channel: channel,
        p_dedup_key: dedup_key || null,
      });
      const verdict = check as any;

      if (verdict?.allow !== true) {
        // Defer if quiet-hours and not critical
        if (verdict?.reason === "defer" && !critical) {
          await supabase.from("notification_queue").insert({
            user_id, notification_type, channel, title,
            body: msgBody, dedup_key, reference_id,
            payload: { data, url },
            scheduled_for: defer_until(prefs, now).toISOString(),
            status: "pending",
          } as any).select().single().then(() => {}, () => {});
          results[channel] = "deferred";
        } else {
          results[channel] = `skipped:${verdict?.reason || "unknown"}`;
        }
        continue;
      }

      // Send via the appropriate worker
      try {
        let endpoint = "";
        let payload: any = {};
        if (channel === "push") {
          endpoint = "push-notify";
          payload = {
            user_id, title, body: msgBody, notification_type,
            dedup_key, reference_id, data: { url: url || "/dashboard", ...data },
          };
        } else if (channel === "email") {
          endpoint = "send-email";
          payload = {
            user_id, subject: title, html: `<p>${msgBody}</p>`,
            text: msgBody, notification_type, dedup_key,
          };
        } else if (channel === "sms") {
          endpoint = "send-sms";
          payload = {
            user_id, body: `${title}\n${msgBody}`,
            notification_type, dedup_key,
          };
        } else if (channel === "whatsapp") {
          endpoint = "send-whatsapp";
          payload = {
            user_id, body: `*${title}*\n${msgBody}`,
            notification_type, dedup_key,
          };
        }

        const res = await fetch(`${supabaseUrl}/functions/v1/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify(payload),
        });
        const j = await res.json().catch(() => ({}));
        results[channel] = j;

        // Log history (the worker may also log, but our row is the source of truth)
        if (dedup_key) {
          await supabase.from("notification_history").insert({
            user_id, notification_type, channel, title,
            body: msgBody, dedup_key, reference_id,
          } as any).select().single().then(() => {}, () => {});
        }
      } catch (e) {
        results[channel] = `error:${(e as Error).message}`;
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-dispatch error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
