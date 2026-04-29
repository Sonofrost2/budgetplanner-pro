// Processes deferred notifications (quiet-hours overflow) and replays them
// once the user's quiet window has passed. Runs every 5 min via cron.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: due } = await supabase
      .from("notification_queue")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(200);

    let processed = 0, failed = 0, digested = 0;

    // === Group digest-routed items per (user, channel, slot) and send ONE
    // aggregated push/email instead of N separate ones. Items routed via
    // digest carry payload.digest_slot (set by notify-dispatch).
    const digestGroups = new Map<string, any[]>();
    const singles: any[] = [];
    for (const item of due || []) {
      const slot = (item.payload as any)?.digest_slot;
      if (slot) {
        const key = `${item.user_id}::${item.channel}::${slot}`;
        if (!digestGroups.has(key)) digestGroups.set(key, []);
        digestGroups.get(key)!.push(item);
      } else {
        singles.push(item);
      }
    }

    // 1) Send aggregated digests
    for (const [key, items] of digestGroups) {
      const [user_id, channel, slot] = key.split("::");
      const titlePrefix = slot === "morning" ? "☀️ Digest matinal" : "🌙 Digest du soir";
      const aggregatedTitle = items.length === 1
        ? items[0].title
        : `${titlePrefix} (${items.length})`;
      const aggregatedBody = items.length === 1
        ? items[0].body
        : items.map(i => `• ${i.title}${i.body ? " — " + i.body : ""}`).join("\n");

      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/notify-dispatch`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            user_id,
            notification_type: items.length === 1 ? items[0].notification_type : `digest_${slot}`,
            title: aggregatedTitle,
            body: aggregatedBody,
            dedup_key: `digest:${slot}:${new Date().toISOString().slice(0,10)}:${channel}`,
            channels: [channel],
            critical: true, // already deferred — bypass routing this time
          }),
        });
        const ok = res.ok;
        const ids = items.map(i => i.id);
        await supabase.from("notification_queue").update({
          status: ok ? "sent" : "failed",
          processed_at: new Date().toISOString(),
          attempts: items[0].attempts + 1,
          last_error: ok ? null : `digest_http_${res.status}`,
        }).in("id", ids);
        if (ok) digested += items.length; else failed += items.length;
      } catch (e) {
        const ids = items.map(i => i.id);
        await supabase.from("notification_queue").update({
          status: "pending",
          attempts: items[0].attempts + 1,
          last_error: (e as Error).message,
        }).in("id", ids);
        failed += items.length;
      }
    }

    // 2) Replay legacy quiet-hours single deferrals (no digest_slot)
    for (const item of singles) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/notify-dispatch`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            user_id: item.user_id,
            notification_type: item.notification_type,
            title: item.title,
            body: item.body,
            dedup_key: item.dedup_key,
            reference_id: item.reference_id,
            channels: [item.channel],
            critical: true, // already deferred once — send unconditionally now
            ...(item.payload as any),
          }),
        });
        const ok = res.ok;
        await supabase.from("notification_queue").update({
          status: ok ? "sent" : "failed",
          processed_at: new Date().toISOString(),
          attempts: (item.attempts || 0) + 1,
          last_error: ok ? null : `http_${res.status}`,
        }).eq("id", item.id);
        ok ? processed++ : failed++;
      } catch (e) {
        await supabase.from("notification_queue").update({
          status: (item.attempts || 0) >= 3 ? "failed" : "pending",
          attempts: (item.attempts || 0) + 1,
          last_error: (e as Error).message,
        }).eq("id", item.id);
        failed++;
      }
    }

    return new Response(JSON.stringify({ processed, digested, failed, considered: due?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-notification-queue error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
