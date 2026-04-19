import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';
import { corsHeaders } from 'https://esm.sh/@supabase/supabase-js@2.95.0/cors';
import { requirePlan } from "../_shared/requirePlan.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // PDF/Excel export = premium; JSON full export = pro+
    const gate = await requirePlan(req, ["pro", "premium"], { feature: "export_full", auditSubtype: "export-user-data" });
    if (!gate.ok) return gate.response!;
    const userId = gate.userId!;

    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const userData = { user: { id: userId, email: '' } };
    const tables = [
      'profiles', 'payment_accounts', 'categories', 'transactions', 'budgets',
      'savings_goals', 'debts', 'recurring_transactions', 'assets', 'asset_valuations',
      'cash_counts', 'notification_preferences', 'payment_receipts', 'subscriptions',
    ];

    const exportData: Record<string, unknown> = {
      _meta: {
        exported_at: new Date().toISOString(),
        user_id: userId,
        email: userData.user.email,
        version: 1,
      },
    };

    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('*').eq('user_id', userId);
      if (error) {
        console.error(`Export error on ${table}:`, error.message);
        exportData[table] = { error: error.message };
      } else {
        exportData[table] = data ?? [];
      }
    }

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="budgetplanner-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (err) {
    console.error('export-user-data error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
