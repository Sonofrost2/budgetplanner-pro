// Shared helper to gate AI / premium Edge Functions by subscription tier.
//
// Features:
//  - Verifies JWT + retrieves userId
//  - Reads ACTIVE & NON-EXPIRED subscription (current_period_end > now)
//  - Admin bypass (always allowed, no quota)
//  - Daily quota for free users via public.check_and_increment_usage
//  - Audit logging via public.log_audit_event (best-effort)
//  - Smart bilingual error messages with upgrade CTA
//
// Usage:
//   const gate = await requirePlan(req, ['pro','premium'], { feature: 'ai_call', freeQuota: 3 });
//   if (!gate.ok) return gate.response;
//   const { userId, plan, supabase } = gate;

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type PlanName = "free" | "pro" | "premium";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export interface RequirePlanOptions {
  /** Feature key for the daily-usage counter (eg 'ai_call', 'export'). Required to enforce quotas. */
  feature?: string;
  /** Daily quota for FREE users on this feature. Set to 0 to fully block free, undefined for no quota. */
  freeQuota?: number;
  /** Daily quota for PRO users (defaults to unlimited). */
  proQuota?: number;
  /** Daily quota for PREMIUM users (defaults to unlimited). */
  premiumQuota?: number;
  /** Optional sub-tag stored in audit_logs.event_subtype (defaults to feature). */
  auditSubtype?: string;
}

export interface PlanGateResult {
  ok: boolean;
  userId?: string;
  plan?: PlanName;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase?: any;
  usage?: { used: number; limit: number | null; remaining: number | null };
  response?: Response;
}

function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || null;
}

function denyResponse(
  status: number,
  payload: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function requirePlan(
  req: Request,
  allowed: PlanName[],
  options: RequirePlanOptions = {},
): Promise<PlanGateResult> {
  const ip = getClientIp(req);
  const ua = req.headers.get("user-agent");
  const subtype = options.auditSubtype || options.feature || "premium_call";

  // 1. Auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      ok: false,
      response: denyResponse(401, {
        error: "Unauthorized",
        message_fr: "Vous devez être connecté pour utiliser cette fonctionnalité.",
        message_en: "You must be signed in to use this feature.",
      }),
    };
  }

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return {
      ok: false,
      response: denyResponse(401, {
        error: "Unauthorized",
        message_fr: "Session invalide. Veuillez vous reconnecter.",
        message_en: "Invalid session. Please sign in again.",
      }),
    };
  }

  const userId = userData.user.id;

  // Service-role client for admin/RPC calls (audit, quotas, plan check)
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Best-effort audit helper
  const audit = (status: string, reason: string | null, metadata: Record<string, unknown> = {}) => {
    adminClient.rpc("log_audit_event", {
      _user_id: userId,
      _actor_id: userId,
      _event_type: "ai_call",
      _event_subtype: subtype,
      _status: status,
      _reason: reason,
      _metadata: metadata,
      _ip: ip,
      _user_agent: ua,
      _resource_id: null,
    }).then(() => {}, () => {});
  };

  // 2. Admin bypass
  const { data: adminRole } = await adminClient
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();

  if (adminRole) {
    audit("success", "admin bypass", { admin: true });
    return { ok: true, userId, plan: "premium", supabase: adminClient };
  }

  // 3. Effective plan (active + not expired)
  const { data: planData } = await adminClient.rpc("is_subscription_valid", { _user_id: userId });
  const planName = ((planData as string) || "free") as PlanName;

  // 4. Plan gate
  if (!allowed.includes(planName)) {
    const required = allowed.join(" or ");
    audit("denied", `plan ${planName} not in [${required}]`, { plan: planName, required: allowed });
    return {
      ok: false,
      userId,
      plan: planName,
      response: denyResponse(403, {
        error: "Plan upgrade required",
        code: "PLAN_REQUIRED",
        required: allowed,
        current: planName,
        message_fr: `Cette fonctionnalité nécessite le plan ${required.toUpperCase()}. Passez à un plan supérieur pour y accéder.`,
        message_en: `This feature requires the ${required.toUpperCase()} plan. Upgrade to unlock.`,
        upgrade_url: "/dashboard/payment",
      }),
    };
  }

  // 5. Quota enforcement (if feature is provided)
  let usage: PlanGateResult["usage"];
  if (options.feature) {
    const limit =
      planName === "premium" ? options.premiumQuota ?? -1
      : planName === "pro" ? options.proQuota ?? -1
      : options.freeQuota ?? -1;

    const effectiveLimit = limit < 0 ? null : limit;

    const { data: quotaResult, error: quotaErr } = await adminClient.rpc(
      "check_and_increment_usage",
      { _user_id: userId, _feature: options.feature, _limit: effectiveLimit },
    );

    if (quotaErr) {
      // Don't hard-fail if quota system has an issue — just log
      console.error("quota rpc error:", quotaErr);
    } else if (quotaResult && (quotaResult as any).allowed === false) {
      const used = (quotaResult as any).used as number;
      const max = (quotaResult as any).limit as number;
      audit("denied", `quota exceeded: ${used}/${max}`, { feature: options.feature, used, limit: max });
      return {
        ok: false,
        userId,
        plan: planName,
        response: denyResponse(429, {
          error: "Quota exceeded",
          code: "QUOTA_EXCEEDED",
          used,
          limit: max,
          message_fr: `Vous avez atteint votre quota quotidien (${used}/${max}). Passez à un plan supérieur pour un accès illimité.`,
          message_en: `You've reached your daily quota (${used}/${max}). Upgrade for unlimited access.`,
          upgrade_url: "/dashboard/payment",
        }),
      };
    } else if (quotaResult) {
      usage = {
        used: (quotaResult as any).used,
        limit: (quotaResult as any).limit,
        remaining: (quotaResult as any).remaining,
      };
    }
  }

  audit("success", null, { plan: planName, ...(usage || {}) });
  return { ok: true, userId, plan: planName, supabase: adminClient, usage };
}
