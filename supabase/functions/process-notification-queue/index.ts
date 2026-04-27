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

    let processed = 0, failed = 0;
    for (const item of due || []) {
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

    return new Response(JSON.stringify({ processed, failed, considered: due?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-notification-queue error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
