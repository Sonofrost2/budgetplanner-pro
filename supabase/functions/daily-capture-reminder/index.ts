// Daily capture reminder — runs hourly, sends a reminder at the user's chosen evening hour
// if no transaction was logged today. Sends a positive streak notif weekly when active.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function fmt(d: Date) { return d.toISOString().split("T")[0]; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const currentHour = now.getUTCHours();
    const todayStr = fmt(now);

    // Get all users with push subscriptions
    const { data: subUsers } = await supabase
      .from("push_subscriptions").select("user_id").limit(1000);
    const uniqueIds = [...new Set((subUsers || []).map((s: any) => s.user_id))];

    let sent = 0;
    for (const userId of uniqueIds) {
      const [{ data: prefs }, { data: profile }, { data: txs }] = await Promise.all([
        supabase.from("notification_preferences").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("profiles").select("locale").eq("user_id", userId).maybeSingle(),
        supabase.from("transactions").select("id, created_at")
          .eq("user_id", userId).is("deleted_at", null)
          .gte("date", todayStr).lte("date", todayStr).limit(1),
      ]);

      if (!prefs || prefs.evening_capture_enabled === false) continue;
      const targetHour = Number(prefs.evening_capture_hour) || 20;
      if (currentHour !== targetHour) continue;

      const isFr = (profile?.locale || "fr") === "fr";
      const hasTxToday = (txs?.length || 0) > 0;

      let title: string, body: string, dedupKey: string;

      if (!hasTxToday) {
        title = isFr ? "📝 Quoi de neuf aujourd'hui ?" : "📝 What's new today?";
        body = isFr
          ? "Saisis tes transactions du jour en 30 secondes pour garder ton coach affûté."
          : "Log today's transactions in 30 seconds to keep your coach sharp.";
        dedupKey = `capture_${userId}_${todayStr}`;
      } else {
        // Streak check — only fire weekly (every Monday) and only when 7+ active days
        if (now.getUTCDay() !== 1) continue;
        const sevenAgo = new Date(now); sevenAgo.setDate(sevenAgo.getDate() - 7);
        const { data: streak } = await supabase
          .from("transactions").select("date")
          .eq("user_id", userId).is("deleted_at", null)
          .gte("date", fmt(sevenAgo)).lte("date", todayStr);
        const distinctDays = new Set((streak || []).map((t: any) => t.date)).size;
        if (distinctDays < 7) continue;
        title = isFr ? "🔥 7 jours de saisie d'affilée !" : "🔥 7-day logging streak!";
        body = isFr ? "Bravo, tu construis une vraie habitude financière." : "Awesome, you're building a real money habit.";
        dedupKey = `streak_${userId}_${todayStr}`;
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/push-notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({
          user_id: userId, title, body,
          notification_type: hasTxToday ? "capture_streak" : "daily_capture_reminder",
          dedup_key: dedupKey,
          data: { url: hasTxToday ? "/dashboard" : "/dashboard/transactions?quickAdd=1" },
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (j.reason !== "dedup_skipped") sent++;
    }

    return new Response(JSON.stringify({ checked: uniqueIds.length, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("daily-capture-reminder error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
