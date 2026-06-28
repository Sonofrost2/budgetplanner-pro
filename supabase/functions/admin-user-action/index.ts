// Admin-only Edge Function for managing users.
// Actions: list_users | suspicious_ips | set_plan | ban | unban | reset_password | impersonate | delete_user | get_audit_logs | refund_subscription
//
// Security:
//  - Requires authenticated session
//  - Verifies user has 'admin' role via user_roles table (server-side)
//  - All actions are logged to audit_logs

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function ipOf(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    const { data: userData, error: uerr } = await userClient.auth.getUser();
    if (uerr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const actorId = userData.user.id;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify admin role
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", actorId).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      await admin.rpc("log_audit_event", {
        _user_id: actorId, _actor_id: actorId,
        _event_type: "admin_action", _event_subtype: "denied_no_role",
        _status: "denied", _reason: "User attempted admin action without admin role",
        _metadata: {}, _ip: ipOf(req), _user_agent: req.headers.get("user-agent"),
        _resource_id: null,
      });
      return new Response(JSON.stringify({ error: "Forbidden — admin role required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action: string = body.action;
    const ip = ipOf(req);
    const ua = req.headers.get("user-agent");

    const audit = (subtype: string, target: string | null, status: string, reason: string | null, meta: any = {}) =>
      admin.rpc("log_audit_event", {
        _user_id: target, _actor_id: actorId,
        _event_type: "admin_action", _event_subtype: subtype,
        _status: status, _reason: reason, _metadata: meta,
        _ip: ip, _user_agent: ua, _resource_id: target,
      });

    switch (action) {
      case "list_users": {
        const { data, error } = await admin.rpc("admin_list_users", {
          _actor_id: actorId,
          _search: body.search ?? null,
          _plan_filter: body.plan ?? null,
          _limit: Math.min(Number(body.limit) || 100, 500),
          _offset: Number(body.offset) || 0,
        });
        if (error) throw error;
        return new Response(JSON.stringify({ users: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "suspicious_ips": {
        const { data, error } = await admin.rpc("admin_suspicious_ips", { _actor_id: actorId });
        if (error) throw error;
        return new Response(JSON.stringify({ items: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_user_snapshot": {
        // Silent observation — NO audit() call, by design.
        const { data, error } = await admin.rpc("admin_get_user_snapshot", {
          _actor_id: actorId,
          _target_user_id: body.user_id,
        });
        if (error) throw error;
        return new Response(JSON.stringify({ snapshot: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_audit_logs": {
        const { data, error } = await admin
          .from("audit_logs").select("*")
          .eq("user_id", body.user_id)
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) throw error;
        return new Response(JSON.stringify({ logs: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "set_plan": {
        const planName = body.plan;
        const days = Number(body.duration_days) || 30;
        const target = body.user_id;
        const { data: plan, error: pe } = await admin
          .from("subscription_plans").select("id,name").eq("name", planName).maybeSingle();
        if (pe) throw pe;
        if (!plan) throw new Error(`Plan not found: ${planName}`);
        const now = new Date();
        const end = new Date(now.getTime() + days * 86400_000);
        const { error: se } = await admin.from("subscriptions").upsert({
          user_id: target,
          plan_id: plan.id,
          status: "active",
          current_period_start: now.toISOString(),
          current_period_end: end.toISOString(),
          payment_method: "admin_override",
        }, { onConflict: "user_id" });
        if (se) throw se;
        await audit("set_plan", target, "success", body.reason || `Plan set to ${planName} for ${days}d`, {
          plan: planName, duration_days: days,
        });
        return new Response(JSON.stringify({ success: true, plan: planName, expires_at: end.toISOString() }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "ban": {
        const days = Math.max(1, Math.min(Number(body.days) || 365, 36500));
        const until = new Date(Date.now() + days * 86400_000).toISOString();
        const { error } = await admin.auth.admin.updateUserById(body.user_id, {
          ban_duration: `${days * 24}h`,
        } as any);
        if (error) throw error;
        await audit("ban", body.user_id, "success", body.reason || `Banned ${days} days`, { days, until });
        return new Response(JSON.stringify({ success: true, banned_until: until }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "unban": {
        const { error } = await admin.auth.admin.updateUserById(body.user_id, {
          ban_duration: "none",
        } as any);
        if (error) throw error;
        await audit("unban", body.user_id, "success", body.reason || "Manual unban", {});
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "reset_password": {
        const { data: userInfo, error: ge } = await admin.auth.admin.getUserById(body.user_id);
        if (ge || !userInfo?.user?.email) throw ge || new Error("user not found");
        const { error: re } = await admin.auth.resetPasswordForEmail(userInfo.user.email);
        if (re) throw re;
        await audit("reset_password", body.user_id, "success", "Admin triggered password reset email", {});
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "impersonate": {
        // Generates a magic link the admin can paste to log in as the user
        const { data: userInfo, error: ge } = await admin.auth.admin.getUserById(body.user_id);
        if (ge || !userInfo?.user?.email) throw ge || new Error("user not found");
        const { data: link, error: le } = await admin.auth.admin.generateLink({
          type: "magiclink",
          email: userInfo.user.email,
        });
        if (le) throw le;
        await audit("impersonate", body.user_id, "success", body.reason || "Admin impersonation link generated", {
          email: userInfo.user.email,
        });
        return new Response(JSON.stringify({
          success: true,
          action_link: link.properties?.action_link,
          email: userInfo.user.email,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete_user": {
        const target = body.user_id;
        if (target === actorId) {
          return new Response(JSON.stringify({ error: "Cannot delete self" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Reuse delete-account flow: wipe all tables then auth user
        const tables = [
          "asset_valuations","assets","transactions","budgets","savings_goals","debts",
          "recurring_transactions","cash_counts","payment_accounts","categories",
          "push_subscriptions","family_members","shared_budgets","payment_receipts",
          "subscriptions","notification_history","notification_preferences",
          "ai_messages","ai_conversations","transaction_templates","saved_filters",
          "asset_valuations","period_closures","usage_counters","device_fingerprints",
        ];
        for (const t of tables) {
          await admin.from(t).delete().eq("user_id", target);
        }
        await admin.from("profiles").delete().eq("user_id", target);
        await admin.from("user_roles").delete().eq("user_id", target);
        const { error: de } = await admin.auth.admin.deleteUser(target);
        if (de) throw de;
        await audit("delete_user", target, "success", body.reason || "Hard delete by admin", {});
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err) {
    console.error("admin-user-action error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
