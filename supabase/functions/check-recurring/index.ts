import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    const todayStr = now.toISOString().split("T")[0];

    // ─── 1. Recurring transactions due tomorrow ───
    const { data: recurringDue } = await supabase
      .from("recurring_transactions")
      .select("id, description, amount, type, next_date, user_id")
      .eq("active", true)
      .lte("next_date", tomorrowStr)
      .gte("next_date", todayStr);

    const recurringNotifs: { user_id: string; title: string; body: string }[] = [];
    for (const rt of recurringDue || []) {
      // Check user preference
      const { data: pref } = await supabase
        .from("notification_preferences")
        .select("recurring_reminders")
        .eq("user_id", rt.user_id)
        .single();

      if (pref?.recurring_reminders === false) continue;

      const isExpense = rt.type === "expense";
      recurringNotifs.push({
        user_id: rt.user_id,
        title: isExpense ? "💸 Dépense récurrente à venir" : "💰 Revenu récurrent à venir",
        body: `${rt.description} — ${rt.amount.toLocaleString()} ${isExpense ? "à payer" : "attendu"} le ${rt.next_date}`,
      });
    }

    // ─── 2. Savings goals reached (current >= target) ───
    const { data: reachedGoals } = await supabase
      .from("savings_goals")
      .select("id, name, current_amount, target_amount, user_id")
      .gte("current_amount", 0);

    const goalNotifs: { user_id: string; title: string; body: string }[] = [];
    for (const goal of reachedGoals || []) {
      if (Number(goal.current_amount) < Number(goal.target_amount)) continue;
      if (Number(goal.target_amount) <= 0) continue;

      const { data: pref } = await supabase
        .from("notification_preferences")
        .select("goal_reached")
        .eq("user_id", goal.user_id)
        .single();

      if (pref?.goal_reached === false) continue;

      goalNotifs.push({
        user_id: goal.user_id,
        title: "🎯 Objectif d'épargne atteint !",
        body: `Félicitations ! Votre objectif "${goal.name}" a atteint ${Number(goal.current_amount).toLocaleString()} / ${Number(goal.target_amount).toLocaleString()}`,
      });
    }

    // ─── 3. Send push notifications via push-notify function ───
    const allNotifs = [...recurringNotifs, ...goalNotifs];
    let sent = 0;

    for (const notif of allNotifs) {
      try {
        await supabase.functions.invoke("push-notify", {
          body: {
            user_id: notif.user_id,
            title: notif.title,
            body: notif.body,
            icon: "/icons/icon-192.png",
          },
        });
        sent++;
      } catch (e) {
        console.error("Failed to send notification:", e);
      }
    }

    return new Response(
      JSON.stringify({
        recurring_due: recurringNotifs.length,
        goals_reached: goalNotifs.length,
        sent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("check-recurring error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
