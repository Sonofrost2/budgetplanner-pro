import { requirePlan } from "../_shared/requirePlan.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Taux d'intérêt de référence du marché UEMOA (épargne classique)
const BANK_RATES: Record<string, { rate: number; type: string }> = {
  'SGCI': { rate: 3.5, type: 'Compte épargne classique' },
  'BICICI': { rate: 3.5, type: 'Compte épargne classique' },
  'BOA': { rate: 3.5, type: 'Compte épargne classique' },
  'Ecobank': { rate: 3.25, type: 'Compte épargne classique' },
  'NSIA Banque': { rate: 3.5, type: 'Compte épargne classique' },
  'Coris Bank': { rate: 3.5, type: 'Compte épargne classique' },
  'SIB': { rate: 3.5, type: 'Compte épargne standard' },
  'BNI': { rate: 3.0, type: 'Compte épargne classique' },
  'BIAO': { rate: 3.25, type: 'Compte épargne classique' },
  'UBA': { rate: 3.0, type: 'Compte épargne classique' },
  'Banque Atlantique': { rate: 3.5, type: 'Compte épargne classique' },
  'Bridge Bank': { rate: 3.5, type: 'Compte épargne classique' },
  'Orabank': { rate: 3.25, type: 'Compte épargne classique' },
  'BGFI Bank': { rate: 3.5, type: 'Compte épargne classique' },
  'Société Générale': { rate: 3.5, type: 'Compte épargne classique' },
  'BDU': { rate: 3.5, type: 'Compte épargne classique' },
  'CAG SGCI': { rate: 5.0, type: 'Compte à terme 12 mois' },
  'CAG BICICI': { rate: 5.0, type: 'Compte à terme 12 mois' },
  'CAG BOA': { rate: 4.75, type: 'Compte à terme 12 mois' },
  'CAG Ecobank': { rate: 4.5, type: 'Compte à terme 12 mois' },
};

/** Get the contribution date for a given month, clamped to last day of month */
function getContributionDate(year: number, month: number, contributionDay: number): Date {
  // month is 0-indexed
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(contributionDay, lastDay);
  return new Date(year, month, day);
}

/** Count real days between two dates */
function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
}

interface ProjectionMonth {
  month: number;
  capital: number;
  interest_earned: number;
  total: number;
}

interface ProjectionResult {
  monthly: ProjectionMonth[];
  interest1y: number;
  interest3y: number;
  interest5y: number;
  estimatedGoalDate: string | null;
}

/**
 * Compute projections using real calendar dates.
 * contributionDay: day of month (1-31) when contribution is deposited.
 * Interest accrues daily and compounds at the given frequency.
 */
function computeProjections(
  currentAmount: number,
  monthlyContribution: number,
  annualRate: number,
  frequency: string,
  startDate: string | null,
  deadline: string | null,
  targetAmount: number,
  contributionDay: number,
): ProjectionResult {
  const dailyRate = annualRate / 100 / 365;

  const freqMonths: Record<string, number> = {
    monthly: 1, quarterly: 3, semi_annual: 6, yearly: 12,
  };
  const compoundEvery = freqMonths[frequency] || 12;

  // Helper: simulate for N months from start
  const simulate = (numMonths: number) => {
    const start = startDate ? new Date(startDate) : new Date();
    let balance = currentAmount;
    let totalInterest = 0;
    let accruedInterest = 0;
    let monthsSinceCompound = 0;
    let prevDate = new Date(start);
    let goalReachedMonth: number | null = null;

    const monthly: ProjectionMonth[] = [];

    for (let m = 1; m <= numMonths; m++) {
      // Determine contribution date for this month
      const contribDate = getContributionDate(
        start.getFullYear() + Math.floor((start.getMonth() + m) / 12),
        (start.getMonth() + m) % 12,
        contributionDay,
      );

      // Days elapsed since last event
      const days = daysBetween(prevDate, contribDate);

      // Accrue interest for this interval
      accruedInterest += balance * dailyRate * days;

      // Add contribution
      balance += monthlyContribution;

      monthsSinceCompound++;

      // Compound when frequency period reached
      if (monthsSinceCompound >= compoundEvery) {
        balance += accruedInterest;
        totalInterest += accruedInterest;
        accruedInterest = 0;
        monthsSinceCompound = 0;
      }

      prevDate = contribDate;

      if (goalReachedMonth === null && balance + accruedInterest >= targetAmount && targetAmount > 0) {
        goalReachedMonth = m;
      }

      monthly.push({
        month: m,
        capital: Math.round(balance),
        interest_earned: Math.round(totalInterest + accruedInterest),
        total: Math.round(balance + accruedInterest),
      });
    }

    // Flush remaining accrued interest
    if (accruedInterest > 0) {
      totalInterest += accruedInterest;
      balance += accruedInterest;
    }

    return { balance: Math.round(balance), interest: Math.round(totalInterest), monthly, goalReachedMonth };
  };

  // For display: up to deadline or 24 months
  const start = startDate ? new Date(startDate) : new Date();
  const end = deadline ? new Date(deadline) : new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
  const totalDays = daysBetween(start, end);
  const displayMonths = Math.min(Math.max(Math.ceil(totalDays / 30), 1), 24);

  const display = simulate(displayMonths);
  const r1y = simulate(12);
  const r3y = simulate(36);
  const r5y = simulate(60);

  // Estimate goal date
  let estimatedGoalDate: string | null = null;
  if (targetAmount > 0 && monthlyContribution > 0) {
    const goalMonth = display.goalReachedMonth ?? (() => {
      // Extend search up to 600 months
      const ext = simulate(600);
      return ext.goalReachedMonth;
    })();
    if (goalMonth !== null) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + goalMonth);
      estimatedGoalDate = d.toISOString().split("T")[0];
    }
  }

  return {
    monthly: display.monthly,
    interest1y: r1y.interest,
    interest3y: r3y.interest,
    interest5y: r5y.interest,
    estimatedGoalDate,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const gate = await requirePlan(req, ["premium"], { feature: "ai_savings_simulate", auditSubtype: "ai-savings-simulate" });
    if (!gate.ok) return gate.response!;

    const {
      goal_name, current_amount, target_amount, monthly_contribution,
      interest_rate, interest_frequency, is_locked, bank_name, deadline,
      start_date, locale, currency, contribution_day,
    } = await req.json();
    const cur = currency || "XOF";

    let rate = Number(interest_rate) || 0;
    const monthly = Number(monthly_contribution) || 0;
    const current = Number(current_amount) || 0;
    const target = Number(target_amount) || 0;
    const contribDay = Number(contribution_day) || 1;

    // Auto-fill rate from bank reference if user rate is 0
    const bankRef = bank_name ? BANK_RATES[bank_name] || null : null;
    if (rate === 0 && bankRef) {
      rate = bankRef.rate;
    }

    // Build market comparison data
    const marketRates = Object.entries(BANK_RATES)
      .filter(([, v]) => v.type.includes('classique') || v.type.includes('standard'))
      .map(([name, v]) => `${name}: ${v.rate}%`)
      .slice(0, 8);

    const classicRates = Object.values(BANK_RATES).filter(v => v.type.includes('classique'));
    const bestRate = Math.max(...Object.values(BANK_RATES).map(v => v.rate));
    const avgRate = classicRates.reduce((s, v) => s + v.rate, 0) / classicRates.length;

    // === SCENARIO 1: Continue contributions ===
    const projContinue = computeProjections(
      current, monthly, rate, interest_frequency || "yearly",
      start_date, deadline, target, contribDay,
    );

    // === SCENARIO 2: Stop contributions now ===
    const projStop = computeProjections(
      current, 0, rate, interest_frequency || "yearly",
      start_date, deadline, target, contribDay,
    );

    const interestLost = Math.max(0, projContinue.interest1y - projStop.interest1y);

    // AI for recommendations only
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const lang = locale === "fr" ? "français" : "English";
    const remaining = Math.max(0, target - current);
    const monthsToGoal = monthly > 0 ? Math.ceil(remaining / monthly) : null;

    const prompt = `Tu es un conseiller financier expert spécialisé dans le marché bancaire UEMOA/CEMAC. Analyse cette épargne et donne des recommandations PRÉCISES, CHIFFRÉES et OBJECTIVES.

Données de l'épargne :
- Nom : ${goal_name}
- Devise : ${cur}
- Capital actuel : ${current.toLocaleString('fr-FR')} ${cur} | Objectif : ${target.toLocaleString('fr-FR')} ${cur} | Restant : ${remaining.toLocaleString('fr-FR')} ${cur}
- Cotisation mensuelle : ${monthly ? monthly.toLocaleString('fr-FR') + " " + cur : "Non définie"}
- Jour de cotisation : le ${contribDay} de chaque mois
- Taux d'intérêt appliqué : ${rate}% annuel (fréquence : ${interest_frequency || "annuel"})
- Bloquée : ${is_locked ? "Oui" : "Non"}
- Banque : ${bank_name || "Non précisée"}
- Date de début : ${start_date || "Aujourd'hui"}
- Date limite : ${deadline || "Pas de date limite"}

SCÉNARIO 1 - Cotisations continues :
- Intérêts estimés 1 an : ${projContinue.interest1y.toLocaleString('fr-FR')} ${cur}
- Intérêts estimés 3 ans : ${projContinue.interest3y.toLocaleString('fr-FR')} ${cur}
- Intérêts estimés 5 ans : ${projContinue.interest5y.toLocaleString('fr-FR')} ${cur}
- Date estimée d'atteinte : ${projContinue.estimatedGoalDate || "Inconnue"}

SCÉNARIO 2 - Arrêt des cotisations aujourd'hui :
- Intérêts estimés 1 an : ${projStop.interest1y.toLocaleString('fr-FR')} ${cur}
- Intérêts estimés 3 ans : ${projStop.interest3y.toLocaleString('fr-FR')} ${cur}
- Intérêts estimés 5 ans : ${projStop.interest5y.toLocaleString('fr-FR')} ${cur}
- Manque à gagner en intérêts (1 an) : ${interestLost.toLocaleString('fr-FR')} ${cur}

Taux de référence du marché UEMOA (épargne classique) :
${marketRates.join('\n')}
- Taux moyen marché : ${avgRate.toFixed(2)}%
- Meilleur taux disponible : ${bestRate}%
${bankRef ? `- Taux de référence ${bank_name} : ${bankRef.rate}% (${bankRef.type})` : ''}
${rate < avgRate ? `⚠️ Le taux de ${rate}% est INFÉRIEUR à la moyenne du marché (${avgRate.toFixed(2)}%)` : rate > avgRate ? `✅ Le taux de ${rate}% est SUPÉRIEUR à la moyenne du marché (${avgRate.toFixed(2)}%)` : ''}

IMPORTANT : 
- Tous les montants DOIVENT être en ${cur}, JAMAIS en EUR ou autre devise.
- Compare les DEUX scénarios (cotisations continues vs arrêt) dans tes recommandations.
- Donne des recommandations avec des MONTANTS CHIFFRÉS et des ACTIONS CONCRÈTES.
- Évalue si la mensualité est suffisante pour atteindre l'objectif à temps.

En ${lang}, fournis :
1. Un résumé court (2-3 phrases) de la situation avec comparaison des deux scénarios
2. 4-5 recommandations CONCRÈTES, CHIFFRÉES et ACTIONNABLES`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `Expert financier UEMOA/CEMAC. Réponds en ${lang}. Sois précis, objectif et chiffré. TOUS les montants en ${cur}. Compare toujours les deux scénarios.` },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "savings_advice",
            description: "Return savings recommendations",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string", description: "2-3 sentence summary comparing both scenarios and market rates" },
                recommendations: { type: "array", items: { type: "string" }, description: "4-5 concrete, numbered recommendations with amounts" },
              },
              required: ["summary", "recommendations"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "savings_advice" } },
      }),
    });

    let summary = "";
    let recommendations: string[] = [];

    if (response.ok) {
      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        try {
          const parsed = JSON.parse(toolCall.function.arguments);
          summary = parsed.summary || "";
          recommendations = parsed.recommendations || [];
        } catch {
          console.error("Failed to parse AI response");
        }
      }
    } else {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      summary = locale === "fr"
        ? `Votre épargne "${goal_name}" progresse avec un taux de ${rate}% (moyenne marché : ${avgRate.toFixed(2)}%). ${monthsToGoal ? `Objectif atteignable en ~${monthsToGoal} mois.` : ""}`
        : `Your savings "${goal_name}" is progressing at ${rate}% (market avg: ${avgRate.toFixed(2)}%). ${monthsToGoal ? `Goal reachable in ~${monthsToGoal} months.` : ""}`;
    }

    return new Response(JSON.stringify({
      continue: {
        monthly_projections: projContinue.monthly,
        interest_income_1y: projContinue.interest1y,
        interest_income_3y: projContinue.interest3y,
        interest_income_5y: projContinue.interest5y,
        estimated_goal_date: projContinue.estimatedGoalDate,
      },
      stop_now: {
        monthly_projections: projStop.monthly,
        interest_income_1y: projStop.interest1y,
        interest_income_3y: projStop.interest3y,
        interest_income_5y: projStop.interest5y,
        estimated_goal_date: null,
      },
      interest_lost: interestLost,
      market_avg_rate: Math.round(avgRate * 100) / 100,
      bank_ref_rate: bankRef?.rate || null,
      summary,
      recommendations,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-savings-simulate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
