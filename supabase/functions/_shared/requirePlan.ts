// Shared helper to gate AI Edge Functions by subscription tier.
// Usage:
//   const gate = await requirePlan(req, ['pro','premium']);
//   if (!gate.ok) return gate.response;
//   const userId = gate.userId;

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type PlanName = "free" | "pro" | "premium";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export interface PlanGateResult {
  ok: boolean;
  userId?: string;
  plan?: PlanName;
  response?: Response;
}

export async function requirePlan(req: Request, allowed: PlanName[]): Promise<PlanGateResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }),
    };
  }

  const userId = userData.user.id;

  // Admins bypass plan gating (helps the Plan Switcher / QA)
  const { data: adminRole } = await supabase
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (adminRole) {
    return { ok: true, userId, plan: "premium" };
  }

  const { data: subRows } = await supabase
    .from("subscriptions")
    .select("status, subscription_plans(name)")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  const planName = ((subRows?.[0] as any)?.subscription_plans?.name || "free") as PlanName;

  if (!allowed.includes(planName)) {
    return {
      ok: false,
      userId,
      plan: planName,
      response: new Response(
        JSON.stringify({
          error: "Plan upgrade required",
          required: allowed,
          current: planName,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }

  return { ok: true, userId, plan: planName };
}
