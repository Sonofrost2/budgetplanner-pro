import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { user_id, amount, type, description, account_id } = await req.json();

    if (!user_id || !amount) {
      return new Response(JSON.stringify({ skipped: true, reason: "missing_data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user notification preferences
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    if (!prefs) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_prefs" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check quiet hours
    if (prefs.quiet_hours_enabled) {
      const now = new Date();
      const currentHour = now.getUTCHours(); // Edge functions run in UTC
      const start = prefs.quiet_hours_start;
      const end = prefs.quiet_hours_end;
      const inQuiet = start > end
        ? currentHour >= start || currentHour < end
        : currentHour >= start && currentHour < end;
      if (inQuiet) {
        return new Response(JSON.stringify({ skipped: true, reason: "quiet_hours" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Check if user has push subscriptions
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", user_id)
      .limit(1);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_push_sub" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const notifications: { title: string; body: string }[] = [];

    // 1. Large transaction alert
    if (prefs.large_transaction && amount >= Number(prefs.large_transaction_threshold)) {
      const formattedAmount = new Intl.NumberFormat("fr-FR").format(amount);
      const typeLabel = type === "expense" ? "Dépense" : "Revenu";
      notifications.push({
        title: `💸 ${typeLabel} importante détectée`,
        body: `${description}: ${formattedAmount} FCFA`,
      });
    }

    // 2. Low balance alert (only for expenses with an account)
    if (prefs.low_balance && type === "expense" && account_id) {
      // Get account balance (opening_balance + income - expense)
      const { data: account } = await supabase
        .from("payment_accounts")
        .select("name, opening_balance")
        .eq("id", account_id)
        .single();

      if (account) {
        // Calculate theoretical balance
        const { data: txSum } = await supabase.rpc("get_account_balance_sum", {
          p_account_id: account_id,
        }).maybeSingle();

        // Fallback: query transactions directly
        let balance = account.opening_balance;
        
        const { data: incomeTx } = await supabase
          .from("transactions")
          .select("amount")
          .eq("account_id", account_id)
          .eq("user_id", user_id)
          .eq("type", "income");
        
        const { data: expenseTx } = await supabase
          .from("transactions")
          .select("amount")
          .eq("account_id", account_id)
          .eq("user_id", user_id)
          .eq("type", "expense");

        const totalIncome = (incomeTx || []).reduce((s, t) => s + Number(t.amount), 0);
        const totalExpense = (expenseTx || []).reduce((s, t) => s + Number(t.amount), 0);
        balance = account.opening_balance + totalIncome - totalExpense;

        if (balance <= Number(prefs.low_balance_threshold)) {
          const formattedBalance = new Intl.NumberFormat("fr-FR").format(balance);
          notifications.push({
            title: `⚠️ Solde bas sur ${account.name}`,
            body: `Solde actuel: ${formattedBalance} FCFA (seuil: ${new Intl.NumberFormat("fr-FR").format(Number(prefs.low_balance_threshold))} FCFA)`,
          });
        }
      }
    }

    // Send notifications via push-notify
    let sent = 0;
    for (const notif of notifications) {
      const res = await fetch(`${supabaseUrl}/functions/v1/push-notify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          user_id,
          title: notif.title,
          body: notif.body,
          data: { url: "/dashboard/transactions" },
        }),
      });

      if (res.ok) {
        const result = await res.json();
        sent += result.sent || 0;
      } else {
        console.error("Push-notify call failed:", await res.text());
      }
    }

    return new Response(
      JSON.stringify({ notifications: notifications.length, sent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("notify-transaction error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
