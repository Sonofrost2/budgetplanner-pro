import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all users who have budgets
    const { data: budgetUsers } = await supabase
      .from("budgets")
      .select("user_id")
      .eq("budget_type", "expense")
      .eq("period", "monthly");

    if (!budgetUsers || budgetUsers.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uniqueUserIds = [...new Set(budgetUsers.map((b) => b.user_id))];

    // Current week range (Mon-Sun)
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const weekStart = monday.toISOString().split("T")[0];
    const weekEnd = sunday.toISOString().split("T")[0];

    // Month info
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = lastDay - now.getDate() + 1;
    const weeksLeft = Math.max(1, Math.ceil(daysLeft / 7));

    let totalSent = 0;

    for (const userId of uniqueUserIds) {
      // Get user budgets
      const { data: userBudgets } = await supabase
        .from("budgets")
        .select("id, amount, category_id, categories(name)")
        .eq("user_id", userId)
        .eq("budget_type", "expense")
        .eq("period", "monthly");

      if (!userBudgets || userBudgets.length === 0) continue;

      // Get month transactions
      const { data: monthTxs } = await supabase
        .from("transactions")
        .select("amount, category_id, date")
        .eq("user_id", userId)
        .eq("type", "expense")
        .gte("date", monthStart);

      if (!monthTxs) continue;

      // Calculate weekly target and actual
      let totalWeeklyTarget = 0;
      let totalWeekSpent = 0;

      for (const b of userBudgets) {
        const monthSpent = monthTxs
          .filter((tx) => tx.category_id === b.category_id)
          .reduce((s, tx) => s + Number(tx.amount), 0);
        const remaining = Math.max(0, b.amount - monthSpent);
        const weeklyTarget = Math.round(remaining / weeksLeft);
        const weekSpent = monthTxs
          .filter((tx) => tx.category_id === b.category_id && tx.date >= weekStart && tx.date <= weekEnd)
          .reduce((s, tx) => s + Number(tx.amount), 0);

        totalWeeklyTarget += weeklyTarget;
        totalWeekSpent += Math.round(weekSpent);
      }

      const delta = totalWeeklyTarget - totalWeekSpent;
      const nextWeekTarget = totalWeeklyTarget; // Approximate

      // Get user locale for message
      const { data: profile } = await supabase
        .from("profiles")
        .select("locale, currency")
        .eq("user_id", userId)
        .single();

      const locale = profile?.locale || "fr";
      const currency = profile?.currency || "XOF";

      const fmtAmount = (n: number) => {
        try {
          return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", {
            style: "currency",
            currency,
            maximumFractionDigits: 0,
          }).format(n);
        } catch {
          return `${n} ${currency}`;
        }
      };

      let title: string;
      let body: string;

      if (locale === "fr") {
        if (delta >= 0) {
          title = `🎉 Bravo ! ${fmtAmount(delta)} economises cette semaine`;
          body = `Budget semaine prochaine : ${fmtAmount(nextWeekTarget)}. Continuez ainsi !`;
        } else {
          title = `⚠️ Depassement de ${fmtAmount(Math.abs(delta))} cette semaine`;
          body = `Budget semaine prochaine : ${fmtAmount(nextWeekTarget)}. Ajustez vos depenses.`;
        }
      } else {
        if (delta >= 0) {
          title = `🎉 Great! ${fmtAmount(delta)} saved this week`;
          body = `Next week's budget: ${fmtAmount(nextWeekTarget)}. Keep it up!`;
        } else {
          title = `⚠️ Overspent by ${fmtAmount(Math.abs(delta))} this week`;
          body = `Next week's budget: ${fmtAmount(nextWeekTarget)}. Adjust your spending.`;
        }
      }

      // Send push notification via push-notify function
      try {
        const pushRes = await fetch(`${supabaseUrl}/functions/v1/push-notify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            user_id: userId,
            title,
            body,
            icon: "/icons/icon-192.png",
            data: { url: "/dashboard" },
          }),
        });

        const result = await pushRes.json();
        totalSent += result.sent || 0;
      } catch (e) {
        console.error(`Push error for user ${userId}:`, e);
      }
    }

    return new Response(JSON.stringify({ sent: totalSent, users: uniqueUserIds.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Weekly summary error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
