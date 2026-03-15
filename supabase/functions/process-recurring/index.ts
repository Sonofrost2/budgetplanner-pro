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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date().toISOString().split("T")[0];

    // Fetch all active recurring transactions where next_date <= today
    const { data: dueItems, error: fetchError } = await supabase
      .from("recurring_transactions")
      .select("*")
      .eq("active", true)
      .lte("next_date", today);

    if (fetchError) throw fetchError;
    if (!dueItems || dueItems.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;

    for (const item of dueItems) {
      // Insert the transaction
      const { error: txError } = await supabase.from("transactions").insert({
        user_id: item.user_id,
        type: item.type,
        amount: item.amount,
        description: item.description,
        category_id: item.category_id,
        account_id: item.account_id,
        date: item.next_date,
        notes: "🔄 Auto",
      });

      if (txError) {
        console.error(`Error inserting tx for recurring ${item.id}:`, txError);
        continue;
      }

      // Recalculate account balance if linked
      if (item.account_id) {
        await supabase.rpc("recalculate_account_balance", {
          p_account_id: item.account_id,
        });
      }

      // Advance next_date
      const nextDate = computeNextDate(item.next_date, item.frequency || "monthly");
      await supabase
        .from("recurring_transactions")
        .update({ next_date: nextDate })
        .eq("id", item.id);

      processed++;
    }

    return new Response(JSON.stringify({ processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("process-recurring error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function computeNextDate(currentDate: string, frequency: string): string {
  const d = new Date(currentDate);
  switch (frequency) {
    case "daily": d.setDate(d.getDate() + 1); break;
    case "weekly": d.setDate(d.getDate() + 7); break;
    case "monthly": d.setMonth(d.getMonth() + 1); break;
    case "quarterly": d.setMonth(d.getMonth() + 3); break;
    case "semi_annual": d.setMonth(d.getMonth() + 6); break;
    case "yearly": d.setFullYear(d.getFullYear() + 1); break;
    default: d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().split("T")[0];
}
