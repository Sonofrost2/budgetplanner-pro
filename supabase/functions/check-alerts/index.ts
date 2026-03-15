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

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    // Get all users with push subscriptions
    const { data: subUsers } = await supabase
      .from("push_subscriptions")
      .select("user_id")
      .limit(1000);

    if (!subUsers || subUsers.length === 0) {
      return new Response(JSON.stringify({ checked: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uniqueUserIds = [...new Set(subUsers.map((s) => s.user_id))];
    let totalAlerts = 0;

    for (const userId of uniqueUserIds) {
      const alerts: { title: string; body: string }[] = [];

      // Check budgets
      const [budgetsRes, txRes, savingsRes, savingsTxRes, savingsImportedTxRes, profileRes] = await Promise.all([
        supabase.from("budgets").select("*, categories(name, icon)").eq("user_id", userId),
        supabase
          .from("transactions")
          .select("category_id, amount")
          .eq("user_id", userId)
          .eq("type", "expense")
          .gte("date", monthStart)
          .lte("date", monthEnd),
        supabase.from("savings_goals").select("*").eq("user_id", userId),
        supabase
          .from("transactions")
          .select("amount, notes")
          .eq("user_id", userId)
          .eq("type", "expense")
          .like("notes", "🎯 %")
          .gte("date", monthStart)
          .lte("date", monthEnd),
        // Also check imported savings transactions (description-based)
        supabase
          .from("transactions")
          .select("amount, description, account_id")
          .eq("user_id", userId)
          .eq("type", "income")
          .ilike("description", "%cotisation epargne%")
          .gte("date", monthStart)
          .lte("date", monthEnd),
        supabase.from("profiles").select("locale").eq("user_id", userId).single(),
      ]);

      const locale = profileRes.data?.locale || "fr";
      const budgets = budgetsRes.data || [];
      const txs = txRes.data || [];
      const savings = savingsRes.data || [];
      const savingsTxs = savingsTxRes.data || [];

      // Budget alerts
      for (const budget of budgets) {
        const spent = txs
          .filter((tx) => tx.category_id === budget.category_id)
          .reduce((sum, tx) => sum + Number(tx.amount), 0);
        const pct = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
        const threshold = budget.alert_threshold ?? 80;

        if (spent > budget.amount) {
          alerts.push({
            title: locale === "fr" ? "⚠️ Budget dépassé" : "⚠️ Budget exceeded",
            body: `${(budget.categories as any)?.icon || "📁"} ${budget.name}: ${Math.round(pct)}%`,
          });
        } else if (pct >= threshold) {
          alerts.push({
            title: locale === "fr" ? `📊 Budget à ${Math.round(pct)}%` : `📊 Budget at ${Math.round(pct)}%`,
            body: `${(budget.categories as any)?.icon || "📁"} ${budget.name}`,
          });
        }
      }

      // Savings alerts — no contribution this month
      for (const goal of savings) {
        if (Number(goal.current_amount) >= Number(goal.target_amount)) continue;
        const monthlyNeeded = Number(goal.monthly_contribution) || 0;
        if (monthlyNeeded <= 0) continue;

        const goalContribs = savingsTxs.filter((tx) => tx.notes === `🎯 ${goal.name}`);
        if (goalContribs.length === 0) {
          alerts.push({
            title: locale === "fr" ? "🐷 Rappel épargne" : "🐷 Savings reminder",
            body: `${goal.icon} ${locale === "fr" ? "Aucun versement ce mois pour" : "No contribution this month for"} ${goal.name}`,
          });
        }
      }

      // Send push for each alert
      for (const alert of alerts) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/push-notify`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              user_id: userId,
              title: alert.title,
              body: alert.body,
            }),
          });
          totalAlerts++;
        } catch (e) {
          console.error(`Push failed for user ${userId}:`, e);
        }
      }
    }

    return new Response(JSON.stringify({ checked: uniqueUserIds.length, alerts_sent: totalAlerts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Check alerts error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
