import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Compute period boundaries for a budget */
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
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }
  return { periodStart, periodEnd };
}

function fmt(d: Date): string { return d.toISOString().split("T")[0]; }

function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((t.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${t.getUTCFullYear()}W${String(weekNum).padStart(2, "0")}`;
}

function threeDayBucket(d: Date): string {
  const start = new Date(d.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((d.getTime() - start.getTime()) / 86400000);
  return `${d.getFullYear()}D${Math.floor(dayOfYear / 3)}`;
}

type Alert = {
  title: string;
  body: string;
  notification_type: string;
  dedup_key: string;
  reference_id?: string;
  critical?: boolean; // bypasses daily cap & digest aggregation
};

const CRITICAL_TYPES = new Set([
  "budget_exceeded",
  "daily_budget_exceeded",
  "debt_overdue",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const currentHour = now.getUTCHours();
    const todayStr = fmt(now);
    const weekTag = isoWeek(now);
    const bucket3d = threeDayBucket(now);
    const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = fmt(sevenDaysAgo);
    const sevenDaysLater = new Date(now); sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
    const sevenDaysLaterStr = fmt(sevenDaysLater);
    const yearStart = `${now.getFullYear()}-01-01`;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

    const { data: subUsers } = await supabase
      .from("push_subscriptions").select("user_id").limit(1000);
    if (!subUsers || subUsers.length === 0) {
      return new Response(JSON.stringify({ checked: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uniqueUserIds = [...new Set(subUsers.map((s: any) => s.user_id))];
    let totalAlerts = 0;
    let usersServed = 0;

    for (const userId of uniqueUserIds) {
      // Pre-fetch prefs first for hourly gating
      const { data: prefsRow } = await supabase
        .from("notification_preferences").select("*").eq("user_id", userId).maybeSingle();
      const np: any = prefsRow || {};

      const digestEnabled = np.morning_digest_enabled !== false;
      const digestHour = Number(np.morning_digest_hour) || 7;
      const cadence: string = np.status_reminder_frequency || "weekly";
      const maxPushPerDay = Math.max(1, Number(np.max_push_per_day) || 3);

      // Hourly cron — only run for this user at their chosen hour
      if (currentHour !== digestHour) continue;

      usersServed++;

      // Cadence window suffix for status-type dedup keys
      const statusWindow =
        cadence === "weekly" ? `_w${weekTag}` :
        cadence === "every_3d" ? `_b${bucket3d}` :
        ""; // on_change_only relies on stepped buckets only

      const alerts: Alert[] = [];

      const [budgetsRes, allTxRes, savingsRes, savingsMonthTxRes, recurringRes, profileRes, accountsRes, accountTxRes] = await Promise.all([
        supabase.from("budgets").select("*, categories(name, icon)").eq("user_id", userId).is("deleted_at", null),
        supabase.from("transactions").select("category_id, amount, type, date")
          .eq("user_id", userId).is("deleted_at", null).gte("date", yearStart).lte("date", todayStr),
        supabase.from("savings_goals").select("*").eq("user_id", userId).is("deleted_at", null),
        supabase.from("transactions").select("amount, date, notes, type, account_id, description")
          .eq("user_id", userId).is("deleted_at", null).gte("date", monthStart).lte("date", todayStr),
        supabase.from("recurring_transactions").select("*")
          .eq("user_id", userId).eq("active", true).lte("next_date", sevenDaysLaterStr),
        supabase.from("profiles").select("locale").eq("user_id", userId).maybeSingle(),
        supabase.from("payment_accounts").select("id, name, icon, real_balance, opening_balance")
          .eq("user_id", userId).is("archived_at", null).is("deleted_at", null),
        supabase.from("transactions").select("account_id, amount, type")
          .eq("user_id", userId).is("deleted_at", null).not("account_id", "is", null),
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

      const prefBudgetAlerts = np.budget_alerts !== false;
      const prefBudgetProjections = np.budget_projections !== false;
      const prefDailyBudget = np.daily_budget !== false;
      const prefSavings = np.savings_reminders !== false;
      const prefRecurring = np.recurring_reminders !== false;
      const prefDebt = np.debt_alerts !== false;
      const prefBalance = np.balance_discrepancy !== false;
      const prefGoalReached = np.goal_reached !== false;
      const prefQuietHours = np.quiet_hours_enabled === true;
      const quietStart = Number(np.quiet_hours_start) || 22;
      const quietEnd = Number(np.quiet_hours_end) || 7;

      if (prefQuietHours) {
        const inQuiet = quietStart > quietEnd
          ? (currentHour >= quietStart || currentHour < quietEnd)
          : (currentHour >= quietStart && currentHour < quietEnd);
        if (inQuiet) continue;
      }

      // ────── Budget alerts ──────
      if (prefBudgetAlerts || prefBudgetProjections || prefGoalReached) {
        for (const budget of budgets) {
          const { periodStart, periodEnd } = getBudgetPeriodBounds(
            budget.period || "monthly", now, budget.reference_date
          );
          const periodStartStr = fmt(periodStart);
          const periodEndStr = fmt(periodEnd);
          const isLastDayOfPeriod = todayStr === periodEndStr;

          const budgetType = budget.budget_type || "expense";
          const periodTxs = allTxs.filter(
            (tx: any) => tx.category_id === budget.category_id &&
              tx.type === budgetType &&
              tx.date >= periodStartStr && tx.date <= periodEndStr
          );
          const spent = periodTxs.reduce((s: number, tx: any) => s + Number(tx.amount), 0);
          const amount = Number(budget.amount);
          const pct = amount > 0 ? (spent / amount) * 100 : 0;
          const threshold = budget.alert_threshold ?? 80;
          const controlType = budget.control_type || "max";
          const isMax = controlType === "max";
          const catIcon = (budget.categories as any)?.icon || "📁";
          const pctStep = Math.floor(pct / 10) * 10; // 10pt buckets for "on_change_only"

          const daysElapsed = Math.max(1, Math.floor((now.getTime() - periodStart.getTime()) / 86400000) + 1);
          const daysTotal = Math.max(1, Math.floor((periodEnd.getTime() - periodStart.getTime()) / 86400000) + 1);
          const daysRemaining = Math.max(0, Math.floor((periodEnd.getTime() - now.getTime()) / 86400000));

          const recentTxs = periodTxs.filter((tx: any) => tx.date >= sevenDaysAgoStr);
          const spent7 = recentTxs.reduce((s: number, tx: any) => s + Number(tx.amount), 0);
          const recentDays = Math.min(7, daysElapsed);
          const dailyRate = recentDays > 0 ? spent7 / recentDays : spent / daysElapsed;
          const projection = spent + dailyRate * daysRemaining;
          const daysToExceed = dailyRate > 0 ? Math.round((amount - spent) / dailyRate) : Infinity;

          if (isMax) {
            if (prefBudgetAlerts && spent > amount) {
              // CRITICAL — always fires, deduped per day
              alerts.push({
                title: isFr ? "⚠️ Budget dépassé" : "⚠️ Budget exceeded",
                body: `${catIcon} ${budget.name}: ${Math.round(pct)}% — +${Math.round(spent - amount).toLocaleString()}`,
                notification_type: "budget_exceeded",
                dedup_key: `budget_exceeded_${budget.id}_${todayStr}`,
                reference_id: budget.id,
                critical: true,
              });
            } else if (prefBudgetAlerts && pct >= threshold) {
              // Threshold reached — windowed by cadence + 10pt step
              alerts.push({
                title: isFr ? `📊 Budget à ${Math.round(pct)}%` : `📊 Budget at ${Math.round(pct)}%`,
                body: `${catIcon} ${budget.name} (${isFr ? "seuil" : "threshold"} ${threshold}%)`,
                notification_type: "budget_threshold",
                dedup_key: `budget_threshold_${budget.id}_step${pctStep}${statusWindow}`,
                reference_id: budget.id,
              });
            } else if (prefBudgetProjections && projection > amount && pct >= 40 && daysToExceed < daysRemaining && daysToExceed > 0) {
              alerts.push({
                title: isFr ? `📈 Dépassement estimé dans ~${daysToExceed}j` : `📈 Projected to exceed in ~${daysToExceed}d`,
                body: `${catIcon} ${budget.name}: ${Math.round(projection).toLocaleString()} (${Math.round((projection / amount) * 100)}%)`,
                notification_type: "budget_projection",
                dedup_key: `budget_proj_${budget.id}_step${pctStep}${statusWindow}`,
                reference_id: budget.id,
              });
            } else if (prefGoalReached && isLastDayOfPeriod && pct < 90) {
              // End-of-period bilan — only on the last day
              alerts.push({
                title: isFr ? "🏁 Bilan : budget maîtrisé !" : "🏁 Bilan: budget under control!",
                body: `${catIcon} ${budget.name}: ${Math.round(amount - spent).toLocaleString()} ${isFr ? "économisés" : "saved"}`,
                notification_type: "budget_controlled",
                dedup_key: `budget_ctrl_${budget.id}_${periodEndStr}`,
                reference_id: budget.id,
              });
            }
          } else {
            const expDay = budget.expected_day ? Number(budget.expected_day) : null;
            const pastExpectedDay = expDay ? now.getDate() >= expDay : daysElapsed > daysTotal * 0.5;

            if (prefGoalReached && spent >= amount && isLastDayOfPeriod) {
              alerts.push({
                title: isFr ? "🏁 Bilan : objectif atteint !" : "🏁 Bilan: target reached!",
                body: `${catIcon} ${budget.name}: +${Math.round(spent - amount).toLocaleString()} ${isFr ? "au-dessus" : "above"}`,
                notification_type: "budget_goal_reached",
                dedup_key: `budget_goal_${budget.id}_${periodEndStr}`,
                reference_id: budget.id,
              });
            } else if (prefBudgetAlerts && pastExpectedDay && spent < amount) {
              alerts.push({
                title: isFr ? `📊 Objectif à ${Math.round(pct)}%` : `📊 Target at ${Math.round(pct)}%`,
                body: `${catIcon} ${budget.name}: ${isFr ? "manque" : "missing"} ${Math.round(amount - spent).toLocaleString()}`,
                notification_type: "budget_target_behind",
                dedup_key: `budget_target_${budget.id}_step${pctStep}${statusWindow}`,
                reference_id: budget.id,
              });
            }
          }

          // Upcoming expense — J-5, J-2, J-0 (3 envois max)
          if (prefBudgetAlerts && budget.expected_day && isMax) {
            const expDay = Number(budget.expected_day);
            const todayDay = now.getDate();
            const daysUntil = expDay >= todayDay ? expDay - todayDay : 0;
            if (daysUntil === 5 || daysUntil === 2 || daysUntil === 0) {
              alerts.push({
                title: daysUntil === 0
                  ? (isFr ? "📅 Dépense prévue aujourd'hui" : "📅 Expense due today")
                  : (isFr ? `📅 Dépense prévue dans ${daysUntil}j` : `📅 Expense due in ${daysUntil}d`),
                body: `${catIcon} ${budget.name}: ${Math.round(amount).toLocaleString()}`,
                notification_type: "budget_upcoming_expense",
                dedup_key: `budget_exp_${budget.id}_d${daysUntil}_${periodStartStr}`,
                reference_id: budget.id,
              });
            }
          }
        }
      }

      // ────── Daily budget ──────
      if (prefDailyBudget) {
        const expenseBudgets = budgets.filter((b: any) => (b.budget_type || 'expense') === 'expense');
        let weeklyExpenseTarget = 0;
        for (const b of expenseBudgets) {
          const period = b.period || 'monthly';
          if (period === 'daily') weeklyExpenseTarget += Number(b.amount) * 7;
          else if (period === 'weekly') weeklyExpenseTarget += Number(b.amount);
          else if (period === 'monthly') weeklyExpenseTarget += Number(b.amount) / (30.44 / 7);
          else if (period === 'quarterly') weeklyExpenseTarget += Number(b.amount) / (91.31 / 7);
          else if (period === 'semi_annual') weeklyExpenseTarget += Number(b.amount) / (182.62 / 7);
          else if (period === 'yearly') weeklyExpenseTarget += Number(b.amount) / (365.25 / 7);
        }
        const dailyBudgetTarget = weeklyExpenseTarget / 7;
        if (dailyBudgetTarget > 0) {
          const todaysExpenses = allTxs.filter((tx: any) => tx.type === 'expense' && tx.date === todayStr);
          const todaySpent = todaysExpenses.reduce((s: number, tx: any) => s + Number(tx.amount), 0);
          const dailyPct = (todaySpent / dailyBudgetTarget) * 100;
          if (dailyPct >= 100) {
            alerts.push({
              title: isFr ? "🔥 Budget du jour dépassé !" : "🔥 Daily budget exceeded!",
              body: isFr
                ? `${Math.round(todaySpent).toLocaleString()} dépensés (${Math.round(dailyPct)}% de ${Math.round(dailyBudgetTarget).toLocaleString()})`
                : `${Math.round(todaySpent).toLocaleString()} spent (${Math.round(dailyPct)}% of ${Math.round(dailyBudgetTarget).toLocaleString()})`,
              notification_type: "daily_budget_exceeded",
              dedup_key: `daily_exceeded_${todayStr}`,
              critical: true,
            });
          }
        }
      }

      // ────── Recurring reminders — J-5, J-2, J-0 only ──────
      if (prefRecurring) {
        for (const rec of recurringTxs) {
          const nextDate = new Date(rec.next_date);
          const daysUntil = Math.max(0, Math.floor((nextDate.getTime() - now.getTime()) / 86400000));
          if (daysUntil === 5 || daysUntil === 2 || daysUntil === 0) {
            const typeLabel = rec.type === "income"
              ? (isFr ? "revenu" : "income")
              : (isFr ? "dépense" : "expense");
            alerts.push({
              title: daysUntil === 0
                ? (isFr ? "📋 Échéance aujourd'hui" : "📋 Due today")
                : (isFr ? `📋 Échéance dans ${daysUntil}j` : `📋 Due in ${daysUntil}d`),
              body: `${rec.description}: ${Math.round(Number(rec.amount)).toLocaleString()} (${typeLabel})`,
              notification_type: "recurring_reminder",
              dedup_key: `recurring_${rec.id}_d${daysUntil}_${rec.next_date}`,
              reference_id: rec.id,
            });
          }
        }
      }

      // ────── Savings ──────
      if (prefSavings || prefGoalReached) {
        for (const goal of savings) {
          if (Number(goal.current_amount) >= Number(goal.target_amount)) {
            if (prefGoalReached) {
              alerts.push({
                title: isFr ? "🎉 Objectif épargne atteint !" : "🎉 Savings goal reached!",
                body: `${goal.icon} ${goal.name}`,
                notification_type: "savings_goal_reached",
                dedup_key: `savings_reached_${goal.id}`,
                reference_id: goal.id,
              });
            }
            continue;
          }
          if (!prefSavings) continue;

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

          const todayDay = now.getDate();
          // Contribution day reminders — J-5, J-2, J-0 only
          if (goal.contribution_day) {
            const cd = Number(goal.contribution_day);
            const daysUntil = cd >= todayDay ? cd - todayDay : 0;
            if (daysUntil === 0 && totalContributed === 0) {
              const monthlyAmount = Number(goal.monthly_contribution) || 0;
              alerts.push({
                title: isFr ? "🐷 Jour de cotisation !" : "🐷 Contribution day!",
                body: `${goal.icon} ${goal.name}${monthlyAmount > 0 ? ` (${Math.round(monthlyAmount).toLocaleString()})` : ""}`,
                notification_type: "savings_contribution_day",
                dedup_key: `savings_contrib_${goal.id}_${now.getFullYear()}m${now.getMonth()}`,
                reference_id: goal.id,
              });
            } else if (daysUntil === 5 || daysUntil === 2) {
              alerts.push({
                title: isFr ? `🐷 Cotisation dans ${daysUntil}j` : `🐷 Contribution in ${daysUntil}d`,
                body: `${goal.icon} ${goal.name}: ${Math.round(Number(goal.monthly_contribution || 0)).toLocaleString()}`,
                notification_type: "savings_contribution_upcoming",
                dedup_key: `savings_upcoming_${goal.id}_d${daysUntil}_${now.getFullYear()}m${now.getMonth()}`,
                reference_id: goal.id,
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

          // Status reminders — once per cadence window only
          if (totalContributed === 0 && !(goal.contribution_day && todayDay === Number(goal.contribution_day))) {
            alerts.push({
              title: isFr ? "🐷 Rappel épargne" : "🐷 Savings reminder",
              body: `${goal.icon} ${isFr ? "Aucun versement ce mois pour" : "No contribution this month for"} ${goal.name}`,
              notification_type: "savings_no_contribution",
              dedup_key: `savings_nocontrib_${goal.id}${statusWindow || `_${now.getFullYear()}m${now.getMonth()}`}`,
              reference_id: goal.id,
            });
          } else if (totalContributed > 0 && totalContributed < monthlyNeeded * 0.9) {
            const pct = Math.round((totalContributed / monthlyNeeded) * 100);
            const pctStep = Math.floor(pct / 10) * 10;
            alerts.push({
              title: isFr ? `🐷 Épargne insuffisante (${pct}%)` : `🐷 Insufficient savings (${pct}%)`,
              body: `${goal.icon} ${goal.name}: ${Math.round(totalContributed)} / ${Math.round(monthlyNeeded)}`,
              notification_type: "savings_insufficient",
              dedup_key: `savings_insuf_${goal.id}_step${pctStep}${statusWindow || `_${now.getFullYear()}m${now.getMonth()}`}`,
              reference_id: goal.id,
            });
          }
        }
      }

      // ────── Debt alerts ──────
      if (prefDebt) {
        const { data: debtsData } = await supabase.from("debts").select("*")
          .eq("user_id", userId).is("deleted_at", null);
        const userDebts = debtsData || [];
        for (const debt of userDebts) {
          const remaining = Number(debt.total_amount) - Number(debt.paid_amount);
          if (remaining <= 0) continue;
          if (!debt.due_date) continue;

          const dueDate = new Date(debt.due_date);
          const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / 86400000);

          if (daysUntilDue < 0) {
            // CRITICAL — fires daily
            alerts.push({
              title: isFr ? "🚨 Dette en retard" : "🚨 Overdue debt",
              body: `${debt.creditor_name}: ${Math.round(remaining).toLocaleString()} ${isFr ? "en retard de" : "overdue by"} ${Math.abs(daysUntilDue)} ${isFr ? "jours" : "days"}`,
              notification_type: "debt_overdue",
              dedup_key: `debt_overdue_${debt.id}_${todayStr}`,
              reference_id: debt.id,
              critical: true,
            });
          } else if (daysUntilDue === 7 || daysUntilDue === 2 || daysUntilDue === 0) {
            alerts.push({
              title: daysUntilDue === 0
                ? (isFr ? "⚠️ Dette due aujourd'hui" : "⚠️ Debt due today")
                : (isFr ? `⚠️ Échéance dette dans ${daysUntilDue}j` : `⚠️ Debt due in ${daysUntilDue}d`),
              body: `${debt.creditor_name}: ${Math.round(remaining).toLocaleString()}`,
              notification_type: "debt_due_soon",
              dedup_key: `debt_due_${debt.id}_d${daysUntilDue}_${debt.due_date}`,
              reference_id: debt.id,
            });
          }
        }
      }

      // ────── Balance discrepancy — 1× / week ──────
      if (prefBalance) {
        for (const account of accounts) {
          const acctTxs = accountTxs.filter((tx: any) => tx.account_id === account.id);
          const txSum = acctTxs.reduce((s: number, tx: any) =>
            s + (tx.type === "income" ? Number(tx.amount) : -Number(tx.amount)), 0);
          const theoreticalBalance = Number(account.opening_balance) + txSum;
          const realBalance = Number(account.real_balance);
          const diff = Math.abs(realBalance - theoreticalBalance);
          const discThreshold = Math.min(500, Math.abs(realBalance) * 0.01 || 500);
          if (diff > discThreshold && diff > 0) {
            const sign = realBalance > theoreticalBalance ? "+" : "-";
            alerts.push({
              title: isFr ? "🔍 Écart de solde détecté" : "🔍 Balance discrepancy",
              body: `${account.icon} ${account.name}: ${sign}${Math.round(diff).toLocaleString()}`,
              notification_type: "balance_discrepancy",
              dedup_key: `balance_disc_${account.id}_w${weekTag}`,
              reference_id: account.id,
            });
          }
        }
      }

      // ───────────────────────────────────────────────
      // 1) Send all CRITICAL alerts immediately (bypass cap)
      // 2) Aggregate non-critical into a SINGLE morning digest
      // 3) Cap respected: digest counts as 1 push
      // ───────────────────────────────────────────────
      const criticals = alerts.filter(a => a.critical || CRITICAL_TYPES.has(a.notification_type));
      const nonCriticals = alerts.filter(a => !(a.critical || CRITICAL_TYPES.has(a.notification_type)));

      // Already sent today (for cap accounting)
      const startOfDay = new Date(now); startOfDay.setUTCHours(0, 0, 0, 0);
      const { count: sentTodayCount } = await supabase
        .from("notification_history")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("sent_at", startOfDay.toISOString());
      let usedToday = sentTodayCount || 0;

      const sendOne = async (a: Alert, channelMeta: Record<string, unknown> = {}) => {
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/push-notify`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({
              user_id: userId,
              title: a.title,
              body: a.body,
              notification_type: a.notification_type,
              dedup_key: a.dedup_key,
              reference_id: a.reference_id,
              data: { url: "/dashboard", ...channelMeta },
            }),
          });
          const j = await res.json().catch(() => ({}));
          if (j.reason !== "dedup_skipped") {
            totalAlerts++;
            usedToday++;
            return true;
          }
        } catch (e) { console.error(`Push failed for ${userId}:`, e); }
        return false;
      };

      // Criticals first — always sent
      for (const a of criticals) await sendOne(a);

      // Non-criticals — aggregate as digest (counts as 1)
      if (digestEnabled && nonCriticals.length > 0 && usedToday < maxPushPerDay) {
        const count = nonCriticals.length;
        const top = nonCriticals.slice(0, 3).map(a => `• ${a.title.replace(/^[^\s]+\s/, "")}`).join("\n");
        const more = count > 3 ? (isFr ? `\n+ ${count - 3} autres alertes` : `\n+ ${count - 3} more alerts`) : "";
        await sendOne({
          title: isFr ? `🌅 Coach matinal — ${count} alerte${count > 1 ? "s" : ""}` : `🌅 Morning Coach — ${count} alert${count > 1 ? "s" : ""}`,
          body: `${top}${more}`,
          notification_type: "morning_digest",
          dedup_key: `morning_digest_${userId}_${todayStr}`,
        }, { digest: true });
      } else if (!digestEnabled) {
        // No digest — fall back to individual sends, capped
        for (const a of nonCriticals) {
          if (usedToday >= maxPushPerDay) {
            const overflow = nonCriticals.length - nonCriticals.indexOf(a);
            await sendOne({
              title: isFr ? `🔔 + ${overflow} autres alertes` : `🔔 + ${overflow} more alerts`,
              body: isFr ? "Voir le détail dans l'app." : "See details in the app.",
              notification_type: "overflow_digest",
              dedup_key: `overflow_${userId}_${todayStr}`,
            });
            break;
          }
          await sendOne(a);
        }
      }
    }

    return new Response(JSON.stringify({ checked: uniqueUserIds.length, served: usersServed, alerts_sent: totalAlerts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Check alerts error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
