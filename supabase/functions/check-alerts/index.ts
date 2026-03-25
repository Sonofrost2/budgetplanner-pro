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

      // Fetch all data needed in parallel (including notification preferences)
      const [budgetsRes, allTxRes, savingsRes, savingsMonthTxRes, recurringRes, profileRes, accountsRes, accountTxRes, prefsRes] = await Promise.all([
        supabase.from("budgets").select("*, categories(name, icon)").eq("user_id", userId),
        supabase.from("transactions").select("category_id, amount, type, date")
          .eq("user_id", userId).gte("date", yearStart).lte("date", todayStr),
        supabase.from("savings_goals").select("*").eq("user_id", userId),
        supabase.from("transactions").select("amount, date, notes, type, account_id, description")
          .eq("user_id", userId).gte("date", monthStart).lte("date", todayStr),
        supabase.from("recurring_transactions").select("*")
          .eq("user_id", userId).eq("active", true)
          .lte("next_date", sevenDaysLaterStr),
        supabase.from("profiles").select("locale").eq("user_id", userId).single(),
        supabase.from("payment_accounts").select("id, name, icon, real_balance, opening_balance").eq("user_id", userId),
        supabase.from("transactions").select("account_id, amount, type")
          .eq("user_id", userId).not("account_id", "is", null).limit(100000),
        supabase.from("notification_preferences").select("*").eq("user_id", userId).maybeSingle(),
      ]);

      const locale = profileRes.data?.locale || "fr";
      const isFr = locale === "fr";
      const budgets = budgetsRes.data || [];
      const allTxs = allTxRes.data || [];
      const savings = savingsRes.data || [];
      const savingsMonthTxs = savingsMonthTxRes.data || [];
      const recurringTxs = recurringRes.data || [];
      const accounts = accountsRes.data || [];
      const accountTxs = accountTxRes.data || [];

      // Notification preferences (defaults: all true)
      const np = prefsRes.data || {};
      const prefBudgetAlerts = np.budget_alerts !== false;
      const prefBudgetProjections = np.budget_projections !== false;
      const prefDailyBudget = np.daily_budget !== false;
      const prefSavings = np.savings_reminders !== false;
      const prefRecurring = np.recurring_reminders !== false;
      const prefDebt = np.debt_alerts !== false;
      const prefBalance = np.balance_discrepancy !== false;
      const prefGoalReached = np.goal_reached !== false;
      const prefLargeTransaction = np.large_transaction !== false;
      const prefLargeThreshold = Number(np.large_transaction_threshold) || 50000;
      const prefLowBalance = np.low_balance === true;
      const prefLowBalanceThreshold = Number(np.low_balance_threshold) || 5000;
      const prefQuietHours = np.quiet_hours_enabled === true;
      const quietStart = Number(np.quiet_hours_start) || 22;
      const quietEnd = Number(np.quiet_hours_end) || 7;

      // Check quiet hours
      if (prefQuietHours) {
        const currentHour = now.getHours();
        const inQuiet = quietStart > quietEnd
          ? (currentHour >= quietStart || currentHour < quietEnd)
          : (currentHour >= quietStart && currentHour < quietEnd);
        if (inQuiet) continue; // Skip this user during quiet hours
      }

      // ────── Budget alerts with improved projections ──────
      if (prefBudgetAlerts || prefBudgetProjections || prefGoalReached) {
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
          if (prefBudgetAlerts && spent > amount) {
            alerts.push({
              title: isFr ? "⚠️ Budget dépassé" : "⚠️ Budget exceeded",
              body: `${catIcon} ${budget.name}: ${Math.round(pct)}% — +${Math.round(spent - amount).toLocaleString()}`,
            });
          } else if (prefBudgetAlerts && pct >= threshold) {
            alerts.push({
              title: isFr ? `📊 Budget à ${Math.round(pct)}%` : `📊 Budget at ${Math.round(pct)}%`,
              body: `${catIcon} ${budget.name} (${isFr ? "seuil" : "threshold"} ${threshold}%)`,
            });
          } else if (prefBudgetProjections && projection > amount && pct >= 40 && daysToExceed < daysRemaining && daysToExceed > 0) {
            alerts.push({
              title: isFr ? `📈 Dépassement estimé dans ~${daysToExceed}j` : `📈 Projected to exceed in ~${daysToExceed}d`,
              body: `${catIcon} ${budget.name}: ${isFr ? "projection" : "projection"} ${Math.round(projection).toLocaleString()} (${Math.round((projection / amount) * 100)}%)`,
            });
          } else if (prefGoalReached && pct < 50 && daysElapsed > daysTotal * 0.7) {
            alerts.push({
              title: isFr ? "🎉 Budget maîtrisé !" : "🎉 Budget under control!",
              body: `${catIcon} ${budget.name}: ${Math.round(amount - spent).toLocaleString()} ${isFr ? "économisés" : "saved"}`,
            });
          }
        } else {
          const expDay = budget.expected_day ? Number(budget.expected_day) : null;
          const pastExpectedDay = expDay ? now.getDate() >= expDay : daysElapsed > daysTotal * 0.5;

          if (prefGoalReached && spent >= amount) {
            alerts.push({
              title: isFr ? "🎉 Objectif atteint !" : "🎉 Target reached!",
              body: `${catIcon} ${budget.name}: +${Math.round(spent - amount).toLocaleString()} ${isFr ? "au-dessus" : "above"}`,
            });
          } else if (prefBudgetAlerts && pastExpectedDay) {
            alerts.push({
              title: isFr ? `📊 Objectif à ${Math.round(pct)}%` : `📊 Target at ${Math.round(pct)}%`,
              body: `${catIcon} ${budget.name}: ${isFr ? "manque" : "missing"} ${Math.round(amount - spent).toLocaleString()}`,
            });
          }
        }

        if (prefBudgetAlerts && budget.expected_day && isMax) {
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
      } // end if prefBudgetAlerts || prefBudgetProjections || prefGoalReached
      }

      // ────── Daily budget alert (80% threshold) ──────
      // Compute weekly expense target and daily budget, check today's spending
      const weekDay = now.getDay();
      const weekMonday = new Date(now);
      weekMonday.setDate(now.getDate() - (weekDay === 0 ? 6 : weekDay - 1));
      weekMonday.setHours(0, 0, 0, 0);
      const weekSunday = new Date(weekMonday);
      weekSunday.setDate(weekMonday.getDate() + 6);
      const weekStartStr = fmt(weekMonday);
      const weekEndStr = fmt(weekSunday);

      // Sum weekly expense targets from all expense budgets
      const expenseBudgets = budgets.filter((b: any) => (b.budget_type || 'expense') === 'expense');
      let weeklyExpenseTarget = 0;
      for (const b of expenseBudgets) {
        const period = b.period || 'monthly';
        if (period === 'daily') {
          weeklyExpenseTarget += Number(b.amount) * 7;
        } else if (period === 'weekly') {
          weeklyExpenseTarget += Number(b.amount);
        } else if (period === 'monthly') {
          weeklyExpenseTarget += Number(b.amount) / (30.44 / 7);
        } else if (period === 'quarterly') {
          weeklyExpenseTarget += Number(b.amount) / (91.31 / 7);
        } else if (period === 'semi_annual') {
          weeklyExpenseTarget += Number(b.amount) / (182.62 / 7);
        } else if (period === 'yearly') {
          weeklyExpenseTarget += Number(b.amount) / (365.25 / 7);
        }
      }

      const dailyBudgetTarget = weeklyExpenseTarget / 7;
      if (dailyBudgetTarget > 0) {
        const todaysExpenses = allTxs.filter(
          (tx: any) => tx.type === 'expense' && tx.date === todayStr
        );
        const todaySpent = todaysExpenses.reduce((sum: number, tx: any) => sum + Number(tx.amount), 0);
        const dailyPct = (todaySpent / dailyBudgetTarget) * 100;

        if (dailyPct >= 100) {
          alerts.push({
            title: isFr ? "🔥 Budget du jour dépassé !" : "🔥 Daily budget exceeded!",
            body: isFr
              ? `${Math.round(todaySpent).toLocaleString()} dépensés aujourd'hui (${Math.round(dailyPct)}% du budget jour de ${Math.round(dailyBudgetTarget).toLocaleString()})`
              : `${Math.round(todaySpent).toLocaleString()} spent today (${Math.round(dailyPct)}% of daily budget ${Math.round(dailyBudgetTarget).toLocaleString()})`,
          });
        } else if (dailyPct >= 80) {
          alerts.push({
            title: isFr ? "⚡ Budget jour à 80%+" : "⚡ Daily budget at 80%+",
            body: isFr
              ? `${Math.round(todaySpent).toLocaleString()} / ${Math.round(dailyBudgetTarget).toLocaleString()} (${Math.round(dailyPct)}%) — Ralentissez vos dépenses !`
              : `${Math.round(todaySpent).toLocaleString()} / ${Math.round(dailyBudgetTarget).toLocaleString()} (${Math.round(dailyPct)}%) — Slow down your spending!`,
          });
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

        // Calculate this month's contributions (same logic as NotificationBell)
        let totalContributed = 0;
        const seen = new Set<string>();
        for (const tx of savingsMonthTxs) {
          const isReturnTx = (tx.description || "").includes("↩");
          if (goal.account_id && tx.account_id === goal.account_id && !isReturnTx && tx.type === "income") {
            const key = tx.date + tx.amount;
            if (!seen.has(key)) { totalContributed += Number(tx.amount); seen.add(key); }
          } else if ((tx as any).notes === `🎯 ${goal.name}` && tx.type === "income" && !isReturnTx) {
            if (!goal.account_id || tx.account_id === goal.account_id) {
              const key = tx.date + tx.amount;
              if (!seen.has(key)) { totalContributed += Number(tx.amount); seen.add(key); }
            }
          }
        }

        // 🐷 Contribution day alert: if today IS the contribution day and no deposit yet
        const todayDay = now.getDate();
        if (goal.contribution_day && todayDay === goal.contribution_day && totalContributed === 0) {
          const monthlyAmount = Number(goal.monthly_contribution) || 0;
          alerts.push({
            title: isFr ? "🐷 Jour de cotisation !" : "🐷 Contribution day!",
            body: `${goal.icon} ${isFr ? "C'est le jour de cotisation pour" : "Today is contribution day for"} ${goal.name}${monthlyAmount > 0 ? ` (${Math.round(monthlyAmount).toLocaleString()})` : ""}`,
          });
        }
        // Upcoming contribution reminder (1-5 days before)
        else if (goal.contribution_day) {
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

        if (totalContributed === 0) {
          // Only add "no contribution" alert if we didn't already send the contribution-day alert
          if (!(goal.contribution_day && todayDay === goal.contribution_day)) {
            alerts.push({
              title: isFr ? "🐷 Rappel épargne" : "🐷 Savings reminder",
              body: `${goal.icon} ${isFr ? "Aucun versement ce mois pour" : "No contribution this month for"} ${goal.name}`,
            });
          }
        } else if (totalContributed < monthlyNeeded * 0.9) {
          const pct = Math.round((totalContributed / monthlyNeeded) * 100);
          alerts.push({
            title: isFr ? `🐷 Épargne insuffisante (${pct}%)` : `🐷 Insufficient savings (${pct}%)`,
            body: `${goal.icon} ${goal.name}: ${Math.round(totalContributed)} / ${Math.round(monthlyNeeded)}`,
          });
        }
      }

      // ────── Debt alerts ──────
      const { data: debtsData } = await supabase.from("debts").select("*").eq("user_id", userId);
      const userDebts = debtsData || [];
      for (const debt of userDebts) {
        const remaining = Number(debt.total_amount) - Number(debt.paid_amount);
        if (remaining <= 0) continue;

        if (debt.due_date) {
          const dueDate = new Date(debt.due_date);
          const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / 86400000);

          if (daysUntilDue < 0) {
            alerts.push({
              title: isFr ? "🚨 Dette en retard" : "🚨 Overdue debt",
              body: `${debt.creditor_name}: ${Math.round(remaining).toLocaleString()} ${isFr ? "en retard de" : "overdue by"} ${Math.abs(daysUntilDue)} ${isFr ? "jours" : "days"}`,
            });
          } else if (daysUntilDue <= 7) {
            alerts.push({
              title: daysUntilDue === 0
                ? (isFr ? "⚠️ Dette due aujourd'hui" : "⚠️ Debt due today")
                : (isFr ? `⚠️ Échéance dette dans ${daysUntilDue}j` : `⚠️ Debt due in ${daysUntilDue}d`),
              body: `${debt.creditor_name}: ${Math.round(remaining).toLocaleString()}`,
            });
          } else if (daysUntilDue <= 30) {
            alerts.push({
              title: isFr ? `📋 Échéance dette dans ${daysUntilDue}j` : `📋 Debt due in ${daysUntilDue}d`,
              body: `${debt.creditor_name}: ${Math.round(remaining).toLocaleString()}`,
            });
          }
        }
      }

      // ────── Balance discrepancy alerts ──────
      for (const account of accounts) {
        const acctTxs = accountTxs.filter((tx: any) => tx.account_id === account.id);
        const txSum = acctTxs.reduce((sum: number, tx: any) => {
          return sum + (tx.type === "income" ? Number(tx.amount) : -Number(tx.amount));
        }, 0);
        const theoreticalBalance = Number(account.opening_balance) + txSum;
        const realBalance = Number(account.real_balance);
        const diff = Math.abs(realBalance - theoreticalBalance);
        const discThreshold = Math.min(500, Math.abs(realBalance) * 0.01 || 500);

        if (diff > discThreshold && diff > 0) {
          const sign = realBalance > theoreticalBalance ? "+" : "-";
          alerts.push({
            title: isFr ? "🔍 Écart de solde détecté" : "🔍 Balance discrepancy",
            body: `${account.icon} ${account.name}: ${sign}${Math.round(diff).toLocaleString()} (${isFr ? "réel" : "actual"}: ${Math.round(realBalance).toLocaleString()} vs ${isFr ? "théorique" : "calculated"}: ${Math.round(theoreticalBalance).toLocaleString()})`,
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
