// Daily cron — send activation reminders to users who completed onboarding
// but haven't activated (3 micro-tasks) yet. Stages: D+1, D+3, D+7.
// Each stage is sent at most once (tracked in profiles.activation_reminders_sent).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireCronAuth } from "../_shared/cronAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Stage = "d1" | "d3" | "d7";
const STAGE_DAYS: Record<Stage, number> = { d1: 1, d3: 3, d7: 7 };

const APP_URL = "https://budgetplanner-pro.lovable.app";

function pickStage(createdAt: string, alreadySent: string[]): Stage | null {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageDays = ageMs / 86_400_000;
  // Pick the highest stage that fits and hasn't been sent yet.
  const order: Stage[] = ["d7", "d3", "d1"];
  for (const s of order) {
    if (ageDays >= STAGE_DAYS[s] && !alreadySent.includes(s)) return s;
  }
  return null;
}

function emailCopy(stage: Stage, locale: "fr" | "en", doneCount: number, totalCount: number) {
  const isFr = locale === "fr";
  const remaining = totalCount - doneCount;
  const tone: Record<Stage, { emojiFr: string; titleFr: string; titleEn: string; ledeFr: string; ledeEn: string }> = {
    d1: {
      emojiFr: "👋",
      titleFr: "Reprenons là où tu t'es arrêté",
      titleEn: "Let's pick up where you left off",
      ledeFr: `Il te reste ${remaining} étape${remaining > 1 ? "s" : ""} pour activer ton Coach Financier — moins de 2 minutes.`,
      ledeEn: `${remaining} step${remaining > 1 ? "s" : ""} left to activate your Financial Coach — under 2 minutes.`,
    },
    d3: {
      emojiFr: "💡",
      titleFr: "Ton Coach attend des données pour t'aider",
      titleEn: "Your Coach needs data to start helping",
      ledeFr: "Sans transactions saisies, on ne peut pas te montrer où part vraiment ton argent. Reprenons ensemble.",
      ledeEn: "Without transactions, we can't show where your money really goes. Let's pick this up together.",
    },
    d7: {
      emojiFr: "🎯",
      titleFr: "Dernière main tendue",
      titleEn: "One last nudge",
      ledeFr: "On ne te relancera plus. Si Budget Planner ne te convient pas, dis-le-nous — on s'améliore grâce à toi.",
      ledeEn: "We won't ping you again. If Budget Planner isn't for you, tell us — your feedback shapes the product.",
    },
  };
  const t = tone[stage];
  return {
    template: "activation-reminder",
    data: {
      stage,
      emoji: t.emojiFr,
      title: isFr ? t.titleFr : t.titleEn,
      lede: isFr ? t.ledeFr : t.ledeEn,
      doneCount,
      totalCount,
      ctaLabel: isFr ? "Continuer mon installation" : "Continue setup",
      ctaUrl: `${APP_URL}/dashboard`,
      locale,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Pull candidates: onboarded, not completed, not dismissed, created at least 1 day ago.
    const cutoff = new Date(Date.now() - 1 * 86_400_000).toISOString();
    const { data: candidates, error } = await admin
      .from("profiles")
      .select("user_id, display_name, locale, activation_reminders_sent, categories_visited_at, created_at, onboarding_completed, activation_completed_at, activation_dismissed_at")
      .eq("onboarding_completed", true)
      .is("activation_completed_at", null)
      .is("activation_dismissed_at", null)
      .lte("created_at", cutoff)
      .limit(500);

    if (error) throw error;

    let sent = 0;
    let skipped = 0;

    for (const p of candidates || []) {
      const sentStages = Array.isArray(p.activation_reminders_sent) ? (p.activation_reminders_sent as string[]) : [];
      const stage = pickStage(p.created_at as string, sentStages);
      if (!stage) { skipped++; continue; }

      // Compute task progress from real data.
      const [{ count: accountsCount }, { count: txCount }] = await Promise.all([
        admin.from("payment_accounts").select("id", { count: "exact", head: true }).eq("user_id", p.user_id).is("deleted_at", null),
        admin.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", p.user_id).is("deleted_at", null),
      ]);
      const done =
        (p.categories_visited_at ? 1 : 0) +
        ((accountsCount ?? 0) >= 1 ? 1 : 0) +
        ((txCount ?? 0) >= 3 ? 1 : 0);
      const total = 3;

      if (done === total) {
        // Catch-up: mark complete and skip.
        await admin.from("profiles").update({ activation_completed_at: new Date().toISOString() }).eq("user_id", p.user_id);
        skipped++;
        continue;
      }

      // Lookup auth email
      const { data: authUser } = await admin.auth.admin.getUserById(p.user_id as string);
      const email = authUser?.user?.email;
      if (!email) { skipped++; continue; }

      const locale: "fr" | "en" = (p.locale as "fr" | "en") || "fr";
      const payload = emailCopy(stage, locale, done, total);

      // Send email
      const emailRes = await admin.functions.invoke("send-email", {
        body: {
          template: payload.template,
          to: email,
          data: { ...payload.data, displayName: p.display_name || email.split("@")[0] },
        },
      });
      if (emailRes.error) {
        console.error("activation-reminder email error", emailRes.error);
        skipped++;
        continue;
      }

      // Best-effort push notification
      try {
        await admin.functions.invoke("push-notify", {
          body: {
            user_id: p.user_id,
            title: locale === "fr" ? "Termine ton installation 🚀" : "Finish your setup 🚀",
            body: locale === "fr"
              ? `Il te reste ${total - done} étape${total - done > 1 ? "s" : ""} pour activer ton Coach.`
              : `${total - done} step${total - done > 1 ? "s" : ""} left to activate your Coach.`,
            url: "/dashboard",
          },
        });
      } catch (_) { /* push optional */ }

      // Mark stage as sent
      await admin
        .from("profiles")
        .update({ activation_reminders_sent: [...sentStages, stage] })
        .eq("user_id", p.user_id);

      sent++;
    }

    return new Response(JSON.stringify({ ok: true, sent, skipped, candidates: candidates?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("send-activation-reminder error", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});