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
      // Get user budgets + savings goals + month transactions in parallel
      const [budgetsRes, savingsRes, monthTxsRes, profileRes, authRes] = await Promise.all([
        supabase.from("budgets").select("id, amount, category_id, categories(name)")
          .eq("user_id", userId).eq("budget_type", "expense").eq("period", "monthly"),
        supabase.from("savings_goals").select("*, payment_accounts(name, opening_balance)")
          .eq("user_id", userId),
        supabase.from("transactions").select("amount, category_id, date, type, account_id, notes, description")
          .eq("user_id", userId).gte("date", monthStart),
        supabase.from("profiles").select("locale, currency, display_name").eq("user_id", userId).single(),
        supabase.auth.admin.getUserById(userId),
      ]);

      const userBudgets = budgetsRes.data || [];
      const savingsGoals = savingsRes.data || [];
      const monthTxs = monthTxsRes.data || [];
      const locale = profileRes.data?.locale || "fr";
      const currency = profileRes.data?.currency || "XOF";
      const isFr = locale === "fr";

      if (userBudgets.length === 0 && savingsGoals.length === 0) continue;

      // Calculate weekly target and actual
      let totalWeeklyTarget = 0;
      let totalWeekSpent = 0;

      const expenseTxs = monthTxs.filter((tx: any) => tx.type === "expense");

      for (const b of userBudgets) {
        const monthSpent = expenseTxs
          .filter((tx: any) => tx.category_id === b.category_id)
          .reduce((s: number, tx: any) => s + Number(tx.amount), 0);
        const remaining = Math.max(0, b.amount - monthSpent);
        const weeklyTarget = Math.round(remaining / weeksLeft);
        const weekSpent = expenseTxs
          .filter((tx: any) => tx.category_id === b.category_id && tx.date >= weekStart && tx.date <= weekEnd)
          .reduce((s: number, tx: any) => s + Number(tx.amount), 0);

        totalWeeklyTarget += weeklyTarget;
        totalWeekSpent += Math.round(weekSpent);
      }

      const delta = totalWeeklyTarget - totalWeekSpent;
      const nextWeekTarget = totalWeeklyTarget;

      const fmtAmount = (n: number) => {
        try {
          return new Intl.NumberFormat(isFr ? "fr-FR" : "en-US", {
            style: "currency", currency, maximumFractionDigits: 0,
          }).format(n);
        } catch {
          return `${n} ${currency}`;
        }
      };

      // ────── Savings contribution recap ──────
      const activeGoals = savingsGoals.filter((g: any) =>
        Number(g.current_amount) < Number(g.target_amount) && (Number(g.monthly_contribution) > 0 || g.deadline)
      );

      let savingsLines: string[] = [];
      let totalPlanned = 0;
      let totalContributed = 0;
      let goalsMissing = 0;

      for (const goal of activeGoals) {
        let monthlyNeeded = Number(goal.monthly_contribution) || 0;
        if (monthlyNeeded <= 0 && goal.deadline) {
          const dl = new Date(goal.deadline);
          if (dl <= now) continue;
          const remaining = Number(goal.target_amount) - Number(goal.current_amount);
          const monthsLeft = Math.max(1, (dl.getFullYear() - now.getFullYear()) * 12 + dl.getMonth() - now.getMonth());
          monthlyNeeded = remaining / monthsLeft;
        }
        if (monthlyNeeded <= 0) continue;

        // Calculate contributions using corrected logic
        let goalContrib = 0;
        const seen = new Set<string>();
        for (const tx of monthTxs) {
          const isReturnTx = ((tx as any).description || "").includes("↩");
          if (goal.account_id && (tx as any).account_id === goal.account_id && !isReturnTx && tx.type === "income") {
            const key = tx.date + tx.amount;
            if (!seen.has(key)) { goalContrib += Number(tx.amount); seen.add(key); }
          } else if ((tx as any).notes === `🎯 ${goal.name}` && tx.type === "income" && !isReturnTx) {
            if (!goal.account_id || (tx as any).account_id === goal.account_id) {
              const key = tx.date + tx.amount;
              if (!seen.has(key)) { goalContrib += Number(tx.amount); seen.add(key); }
            }
          }
        }

        totalPlanned += monthlyNeeded;
        totalContributed += goalContrib;
        if (goalContrib === 0) goalsMissing++;
      }

      // Build notification message
      let title: string;
      let body: string;

      if (isFr) {
        if (delta >= 0) {
          title = `🎉 Bravo ! ${fmtAmount(delta)} economises cette semaine`;
          body = `Budget semaine prochaine : ${fmtAmount(nextWeekTarget)}.`;
        } else {
          title = `⚠️ Depassement de ${fmtAmount(Math.abs(delta))} cette semaine`;
          body = `Budget semaine prochaine : ${fmtAmount(nextWeekTarget)}.`;
        }
        // Append savings recap
        if (activeGoals.length > 0) {
          body += ` 🐷 Épargne: ${fmtAmount(totalContributed)}/${fmtAmount(Math.round(totalPlanned))}`;
          if (goalsMissing > 0) {
            body += ` (${goalsMissing} objectif${goalsMissing > 1 ? "s" : ""} sans versement)`;
          }
        }
      } else {
        if (delta >= 0) {
          title = `🎉 Great! ${fmtAmount(delta)} saved this week`;
          body = `Next week's budget: ${fmtAmount(nextWeekTarget)}.`;
        } else {
          title = `⚠️ Overspent by ${fmtAmount(Math.abs(delta))} this week`;
          body = `Next week's budget: ${fmtAmount(nextWeekTarget)}.`;
        }
        if (activeGoals.length > 0) {
          body += ` 🐷 Savings: ${fmtAmount(totalContributed)}/${fmtAmount(Math.round(totalPlanned))}`;
          if (goalsMissing > 0) {
            body += ` (${goalsMissing} goal${goalsMissing > 1 ? "s" : ""} with no deposit)`;
          }
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
