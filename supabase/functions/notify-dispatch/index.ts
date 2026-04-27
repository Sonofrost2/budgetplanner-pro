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
