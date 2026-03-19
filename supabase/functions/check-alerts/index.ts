import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Compute period boundaries for a budget (mirrors NotificationBell logic) */
function getBudgetPeriodBounds(period: string, now: Date, referenceDate?: string | null) {
  let periodStart: Date, periodEnd: Date;
  if (period === "daily") {
    periodStart = periodEnd = new Date(now);
  } else if (period === "weekly") {
    const day = now.getDay();
    periodStart = new Date(now);
    periodStart.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    periodEnd = new Date(periodStart);
    periodEnd.setDate(periodStart.getDate() + 6);
  } else if (period === "quarterly") {
    if (referenceDate) {
      const ref = new Date(referenceDate);
      periodStart = new Date(ref);
      while (periodStart > now) periodStart.setMonth(periodStart.getMonth() - 3);
      while (new Date(periodStart.getFullYear(), periodStart.getMonth() + 3, periodStart.getDate()) <= now) {
        periodStart.setMonth(periodStart.getMonth() + 3);
      }
      periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 3);
      periodEnd.setDate(periodEnd.getDate() - 1);
    } else {
      const q = Math.floor(now.getMonth() / 3);
      periodStart = new Date(now.getFullYear(), q * 3, 1);
      periodEnd = new Date(now.getFullYear(), q * 3 + 3, 0);
    }
  } else if (period === "semi_annual") {
    const s = now.getMonth() < 6 ? 0 : 6;
    periodStart = new Date(now.getFullYear(), s, 1);
    periodEnd = new Date(now.getFullYear(), s + 6, 0);
  } else if (period === "yearly") {
    periodStart = new Date(now.getFullYear(), 0, 1);
    periodEnd = new Date(now.getFullYear(), 11, 31);
  } else {
    // monthly default
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }
  return { periodStart, periodEnd };
}

function fmt(d: Date): string {
  return d.toISOString().split("T")[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const todayStr = fmt(now);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = fmt(sevenDaysAgo);
    const sevenDaysLater = new Date(now);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    const sevenDaysLaterStr = fmt(sevenDaysLater);
    const yearStart = `${now.getFullYear()}-01-01`;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

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

    const uniqueUserIds = [...new Set(subUsers.map((s: any) => s.user_id))];
    let totalAlerts = 0;

    for (const userId of uniqueUserIds) {
      const alerts: { title: string; body: string }[] = [];

      // Fetch all data needed in parallel
      const [budgetsRes, allTxRes, savingsRes, savingsTxRes, importedSavingsTxRes, recurringRes, profileRes, accountsRes, accountTxRes] = await Promise.all([
        supabase.from("budgets").select("*, categories(name, icon)").eq("user_id", userId),
        supabase.from("transactions").select("category_id, amount, type, date")
          .eq("user_id", userId).gte("date", yearStart).lte("date", todayStr),
        supabase.from("savings_goals").select("*").eq("user_id", userId),
        supabase.from("transactions").select("amount, notes")
          .eq("user_id", userId).eq("type", "expense")
          .like("notes", "🎯 %")
          .gte("date", monthStart).lte("date", todayStr),
        supabase.from("transactions").select("amount, description, account_id")
          .eq("user_id", userId).eq("type", "income")
          .ilike("description", "%cotisation epargne%")
          .gte("date", monthStart).lte("date", todayStr),
        supabase.from("recurring_transactions").select("*")
          .eq("user_id", userId).eq("active", true)
          .lte("next_date", sevenDaysLaterStr),
        supabase.from("profiles").select("locale").eq("user_id", userId).single(),
        supabase.from("payment_accounts").select("id, name, icon, real_balance, opening_balance").eq("user_id", userId),
        supabase.from("transactions").select("account_id, amount, type")
          .eq("user_id", userId).not("account_id", "is", null).limit(100000),
      ]);

      const locale = profileRes.data?.locale || "fr";
      const isFr = locale === "fr";
      const budgets = budgetsRes.data || [];
      const allTxs = allTxRes.data || [];
      const savings = savingsRes.data || [];
      const savingsTxs = savingsTxRes.data || [];
      const importedSavingsTxs = importedSavingsTxRes.data || [];
      const recurringTxs = recurringRes.data || [];
      const accounts = accountsRes.data || [];
      const accountTxs = accountTxRes.data || [];

      // ────── Budget alerts with improved projections ──────
      for (const budget of budgets) {
        const { periodStart, periodEnd } = getBudgetPeriodBounds(
          budget.period || "monthly", now, budget.reference_date
        );
        const periodStartStr = fmt(periodStart);
        const periodEndStr = fmt(periodEnd);

        const budgetType = budget.budget_type || "expense";
        const periodTxs = allTxs.filter(
          (tx: any) => tx.category_id === budget.category_id &&
            tx.type === budgetType &&
            tx.date >= periodStartStr && tx.date <= periodEndStr
        );
        const spent = periodTxs.reduce((sum: number, tx: any) => sum + Number(tx.amount), 0);
        const amount = Number(budget.amount);
        const pct = amount > 0 ? (spent / amount) * 100 : 0;
        const threshold = budget.alert_threshold ?? 80;
        const controlType = budget.control_type || "max";
        const isMax = controlType === "max";
        const catIcon = (budget.categories as any)?.icon || "📁";

        // Improved projection: weighted on last 7 days
        const daysElapsed = Math.max(1, Math.floor((now.getTime() - periodStart.getTime()) / 86400000) + 1);
        const daysTotal = Math.max(1, Math.floor((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1);
        const daysRemaining = Math.max(0, Math.floor((periodEnd.getTime() - now.getTime()) / 86400000));

        const recentTxs = periodTxs.filter((tx: any) => tx.date >= sevenDaysAgoStr);
        const spent7 = recentTxs.reduce((sum: number, tx: any) => sum + Number(tx.amount), 0);
        const recentDays = Math.min(7, daysElapsed);
        const dailyRate = recentDays > 0 ? spent7 / recentDays : spent / daysElapsed;
        const projection = spent + dailyRate * daysRemaining;
        const daysToExceed = dailyRate > 0 ? Math.round((amount - spent) / dailyRate) : Infinity;

        if (isMax) {
          if (spent > amount) {
            // ⚠️ Budget exceeded — with context
            alerts.push({
              title: isFr ? "⚠️ Budget dépassé" : "⚠️ Budget exceeded",
              body: `${catIcon} ${budget.name}: ${Math.round(pct)}% — +${Math.round(spent - amount).toLocaleString()}`,
            });
          } else if (pct >= threshold) {
            // Warning: threshold reached
            alerts.push({
              title: isFr ? `📊 Budget à ${Math.round(pct)}%` : `📊 Budget at ${Math.round(pct)}%`,
              body: `${catIcon} ${budget.name} (${isFr ? "seuil" : "threshold"} ${threshold}%)`,
            });
          } else if (projection > amount && pct >= 40 && daysToExceed < daysRemaining && daysToExceed > 0) {
            // 📈 Predictive alert: "will exceed in ~X days"
            alerts.push({
              title: isFr ? `📈 Dépassement estimé dans ~${daysToExceed}j` : `📈 Projected to exceed in ~${daysToExceed}d`,
              body: `${catIcon} ${budget.name}: ${isFr ? "projection" : "projection"} ${Math.round(projection).toLocaleString()} (${Math.round((projection / amount) * 100)}%)`,
            });
          } else if (pct < 50 && daysElapsed > daysTotal * 0.7) {
            // 🎉 Congratulations: budget under control near end of period
            alerts.push({
              title: isFr ? "🎉 Budget maîtrisé !" : "🎉 Budget under control!",
              body: `${catIcon} ${budget.name}: ${Math.round(amount - spent).toLocaleString()} ${isFr ? "économisés" : "saved"}`,
            });
          }
        } else {
          // Min budget (income target)
          if (spent >= amount) {
            alerts.push({
              title: isFr ? "🎉 Objectif atteint !" : "🎉 Target reached!",
              body: `${catIcon} ${budget.name}: +${Math.round(spent - amount).toLocaleString()} ${isFr ? "au-dessus" : "above"}`,
            });
          } else if (daysElapsed > daysTotal * 0.5) {
            alerts.push({
              title: isFr ? `📊 Objectif à ${Math.round(pct)}%` : `📊 Target at ${Math.round(pct)}%`,
              body: `${catIcon} ${budget.name}: ${isFr ? "manque" : "missing"} ${Math.round(amount - spent).toLocaleString()}`,
            });
          }
        }

        // 📅 Upcoming budget expense reminder via expected_day
        if (budget.expected_day && isMax) {
          const expDay = Number(budget.expected_day);
          const todayDay = now.getDate();
          const daysUntil = expDay >= todayDay ? expDay - todayDay : 0;
          if (daysUntil > 0 && daysUntil <= 5) {
            alerts.push({
              title: isFr ? `📅 Dépense prévue dans ${daysUntil}j` : `📅 Expense due in ${daysUntil}d`,
              body: `${catIcon} ${budget.name}: ${Math.round(amount).toLocaleString()}`,
            });
          }
        }
      }

      // ────── Recurring transaction reminders ──────
      for (const rec of recurringTxs) {
        const nextDate = new Date(rec.next_date);
        const daysUntil = Math.max(0, Math.floor((nextDate.getTime() - now.getTime()) / 86400000));
        if (daysUntil <= 7) {
          const typeLabel = rec.type === "income"
            ? (isFr ? "revenu" : "income")
            : (isFr ? "dépense" : "expense");
          alerts.push({
            title: daysUntil === 0
              ? (isFr ? "📋 Échéance aujourd'hui" : "📋 Due today")
              : (isFr ? `📋 Échéance dans ${daysUntil}j` : `📋 Due in ${daysUntil}d`),
            body: `${rec.description}: ${Math.round(Number(rec.amount)).toLocaleString()} (${typeLabel})`,
          });
        }
      }

      // ────── Savings alerts ──────
      for (const goal of savings) {
        if (Number(goal.current_amount) >= Number(goal.target_amount)) {
          alerts.push({
            title: isFr ? "🎉 Objectif épargne atteint !" : "🎉 Savings goal reached!",
            body: `${goal.icon} ${goal.name}`,
          });
          continue;
        }

        // 🐷 Upcoming contribution reminder
        if (goal.contribution_day) {
          const todayDay = now.getDate();
          const daysUntil = goal.contribution_day >= todayDay ? goal.contribution_day - todayDay : 0;
          if (daysUntil > 0 && daysUntil <= 5) {
            alerts.push({
              title: isFr ? `🐷 Cotisation dans ${daysUntil}j` : `🐷 Contribution in ${daysUntil}d`,
              body: `${goal.icon} ${goal.name}: ${Math.round(Number(goal.monthly_contribution || 0)).toLocaleString()}`,
            });
          }
        }

        let monthlyNeeded = Number(goal.monthly_contribution) || 0;
        if (monthlyNeeded <= 0 && goal.deadline) {
          const dl = new Date(goal.deadline);
          if (dl <= now) continue;
          const remaining = Number(goal.target_amount) - Number(goal.current_amount);
          const monthsLeft = Math.max(1, (dl.getFullYear() - now.getFullYear()) * 12 + dl.getMonth() - now.getMonth());
          monthlyNeeded = remaining / monthsLeft;
        }
        if (monthlyNeeded <= 0) continue;

        const appContribs = savingsTxs.filter((tx: any) => tx.notes === `🎯 ${goal.name}`);
        const importedContribs = importedSavingsTxs.filter((tx: any) =>
          (goal.account_id && tx.account_id === goal.account_id) ||
          tx.description?.toLowerCase().includes(goal.name.toLowerCase().split(" ").slice(0, 2).join(" "))
        );
        const totalContributed = [
          ...appContribs.map((tx: any) => Number(tx.amount)),
          ...importedContribs.map((tx: any) => Number(tx.amount)),
        ].reduce((sum: number, a: number) => sum + a, 0);

        if (totalContributed === 0) {
          alerts.push({
            title: isFr ? "🐷 Rappel épargne" : "🐷 Savings reminder",
            body: `${goal.icon} ${isFr ? "Aucun versement ce mois pour" : "No contribution this month for"} ${goal.name}`,
          });
        } else if (totalContributed < monthlyNeeded * 0.9) {
          const pct = Math.round((totalContributed / monthlyNeeded) * 100);
          alerts.push({
            title: isFr ? `🐷 Épargne insuffisante (${pct}%)` : `🐷 Insufficient savings (${pct}%)`,
            body: `${goal.icon} ${goal.name}: ${Math.round(totalContributed)} / ${Math.round(monthlyNeeded)}`,
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
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
