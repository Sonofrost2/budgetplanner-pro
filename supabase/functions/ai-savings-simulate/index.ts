const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Deterministic compound interest calculation
function computeProjections(
  currentAmount: number,
  monthlyContribution: number,
  annualRate: number,
  frequency: string,
  months: number,
  targetAmount: number,
): {
  monthly: { month: number; capital: number; interest_earned: number; total: number }[];
  interest1y: number;
  interest3y: number;
  interest5y: number;
  estimatedGoalDate: string | null;
} {
  // Determine compounding periods per year
  const freqMap: Record<string, number> = {
    monthly: 12,
    quarterly: 4,
    semi_annual: 2,
    yearly: 1,
  };
  const compPerYear = freqMap[frequency] || 1;
  const ratePerPeriod = annualRate / 100 / compPerYear;

  const monthly: { month: number; capital: number; interest_earned: number; total: number }[] = [];
  let balance = currentAmount;
  let totalInterest = 0;
  let goalReachedMonth: number | null = null;

  // Helper to calculate for N months
  const calc = (numMonths: number) => {
    let bal = currentAmount;
    let accInt = 0;
    for (let m = 1; m <= numMonths; m++) {
      bal += monthlyContribution;
      // Check if interest compounds this month
      const monthsPerPeriod = 12 / compPerYear;
      if (monthsPerPeriod > 0 && m % monthsPerPeriod === 0) {
        const interest = bal * ratePerPeriod;
        bal += interest;
        accInt += interest;
      }
    }
    return { balance: bal, interest: accInt };
  };

  // Monthly projections for display (12 months)
  for (let m = 1; m <= months; m++) {
    balance += monthlyContribution;
    const monthsPerPeriod = 12 / compPerYear;
    let monthInterest = 0;
    if (monthsPerPeriod > 0 && m % Math.round(monthsPerPeriod) === 0) {
      monthInterest = balance * ratePerPeriod;
      balance += monthInterest;
      totalInterest += monthInterest;
    }
    // Cap at target if reached
    if (goalReachedMonth === null && balance >= targetAmount && targetAmount > 0) {
      goalReachedMonth = m;
    }
    monthly.push({
      month: m,
      capital: Math.round(balance - totalInterest),
      interest_earned: Math.round(totalInterest),
      total: Math.round(balance),
    });
  }

  const r1y = calc(12);
  const r3y = calc(36);
  const r5y = calc(60);

  // Estimate goal date
  let estimatedGoalDate: string | null = null;
  if (targetAmount > 0 && monthlyContribution > 0) {
    const now = new Date();
    if (goalReachedMonth !== null) {
      const d = new Date(now);
      d.setMonth(d.getMonth() + goalReachedMonth);
      estimatedGoalDate = d.toISOString().split("T")[0];
    } else {
      // Extend calculation beyond 12 months
      let extBal = balance;
      let extMonth = months;
      while (extBal < targetAmount && extMonth < 600) {
        extMonth++;
        extBal += monthlyContribution;
        const monthsPerPeriod = 12 / compPerYear;
        if (monthsPerPeriod > 0 && extMonth % Math.round(monthsPerPeriod) === 0) {
          extBal += extBal * ratePerPeriod;
        }
      }
      if (extBal >= targetAmount) {
        const d = new Date(now);
        d.setMonth(d.getMonth() + extMonth);
        estimatedGoalDate = d.toISOString().split("T")[0];
      }
    }
  }

  return {
    monthly,
    interest1y: Math.round(r1y.interest),
    interest3y: Math.round(r3y.interest),
    interest5y: Math.round(r5y.interest),
    estimatedGoalDate,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      goal_name, current_amount, target_amount, monthly_contribution,
      interest_rate, interest_frequency, is_locked, bank_name, deadline, locale, currency,
    } = await req.json();
    const cur = currency || "XOF";

    const rate = Number(interest_rate) || 0;
    const monthly = Number(monthly_contribution) || 0;
    const current = Number(current_amount) || 0;
    const target = Number(target_amount) || 0;

    // Deterministic calculation
    const projections = computeProjections(current, monthly, rate, interest_frequency || "yearly", 12, target);

    // AI for recommendations only
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const lang = locale === "fr" ? "français" : "English";
    const remaining = Math.max(0, target - current);
    const monthsToGoal = monthly > 0 ? Math.ceil(remaining / monthly) : null;

    const prompt = `Tu es un conseiller financier expert. Analyse cette épargne et donne des recommandations personnalisées.

Données :
- Nom : ${goal_name}
- Devise : ${cur}
- Capital actuel : ${current} ${cur} | Objectif : ${target} ${cur} | Restant : ${remaining} ${cur}
- Cotisation mensuelle : ${monthly ? monthly + " " + cur : "Non définie"}
- Taux d'intérêt : ${rate}% (fréquence : ${interest_frequency || "annuel"})
- Bloquée : ${is_locked ? "Oui" : "Non"}
- Banque : ${bank_name || "Non précisée"}
- Date limite : ${deadline || "Pas de date limite"}
- Intérêts estimés 1 an : ${projections.interest1y} ${cur} | 3 ans : ${projections.interest3y} ${cur} | 5 ans : ${projections.interest5y} ${cur}
- Mois estimés pour atteindre l'objectif : ${monthsToGoal ?? "N/A"}
- Date estimée : ${projections.estimatedGoalDate || "Inconnue"}

IMPORTANT : Tous les montants sont en ${cur}. Utilise TOUJOURS ${cur} comme devise dans tes réponses, jamais EUR ou autre devise.

En ${lang}, fournis :
1. Un résumé court (2-3 phrases) de la situation
2. 3-4 recommandations concrètes et chiffrées pour optimiser (ajuster mensualité, fréquence intérêts, épargne bloquée vs disponible, etc.)`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: `Expert financier. Réponds en ${lang}. Sois concis et chiffré. TOUS les montants doivent être en ${cur}, jamais en EUR ou autre devise.` },
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
                summary: { type: "string", description: "2-3 sentence summary of the savings situation" },
                recommendations: { type: "array", items: { type: "string" }, description: "3-4 concrete recommendations" },
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
        ? `Votre épargne "${goal_name}" progresse. ${monthsToGoal ? `Objectif atteignable en ~${monthsToGoal} mois.` : ""}`
        : `Your savings "${goal_name}" is progressing. ${monthsToGoal ? `Goal reachable in ~${monthsToGoal} months.` : ""}`;
    }

    return new Response(JSON.stringify({
      monthly_projections: projections.monthly,
      interest_income_1y: projections.interest1y,
      interest_income_3y: projections.interest3y,
      interest_income_5y: projections.interest5y,
      estimated_goal_date: projections.estimatedGoalDate,
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
