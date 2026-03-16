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
  // Comptes à terme / DAT (références)
  'CAG SGCI': { rate: 5.0, type: 'Compte à terme 12 mois' },
  'CAG BICICI': { rate: 5.0, type: 'Compte à terme 12 mois' },
  'CAG BOA': { rate: 4.75, type: 'Compte à terme 12 mois' },
  'CAG Ecobank': { rate: 4.5, type: 'Compte à terme 12 mois' },
};

// Calcul au prorata journalier des intérêts
function computeProrataProjections(
  currentAmount: number,
  monthlyContribution: number,
  annualRate: number,
  frequency: string,
  startDate: string | null,
  deadline: string | null,
  targetAmount: number,
): {
  monthly: { month: number; capital: number; interest_earned: number; total: number }[];
  interest1y: number;
  interest3y: number;
  interest5y: number;
  estimatedGoalDate: string | null;
  totalDays: number;
  dailyRate: number;
} {
  const start = startDate ? new Date(startDate) : new Date();
  const end = deadline ? new Date(deadline) : new Date(new Date().getFullYear(), 11, 31); // default 31/12 current year
  const dailyRate = annualRate / 100 / 365;

  // Helper: calculate interests with daily proration for N months from start
  const calcForMonths = (numMonths: number) => {
    let balance = currentAmount;
    let totalInterest = 0;
    const refDate = new Date(start);

    // Determine compounding frequency in days
    const freqMap: Record<string, number> = {
      monthly: 30, quarterly: 91, semi_annual: 182, yearly: 365,
    };
    const compoundDays = freqMap[frequency] || 365;
    let daysSinceLastCompound = 0;

    for (let m = 1; m <= numMonths; m++) {
      // Add monthly contribution at start of month
      balance += monthlyContribution;

      // Approximate 30 days per month
      const daysInMonth = 30;
      daysSinceLastCompound += daysInMonth;

      // Compound when frequency period reached
      if (daysSinceLastCompound >= compoundDays) {
        const interest = balance * dailyRate * daysSinceLastCompound;
        balance += interest;
        totalInterest += interest;
        daysSinceLastCompound = 0;
      }
    }

    // Add remaining accrued interest
    if (daysSinceLastCompound > 0) {
      const interest = balance * dailyRate * daysSinceLastCompound;
      totalInterest += interest;
      balance += interest;
    }

    return { balance: Math.round(balance), interest: Math.round(totalInterest) };
  };

  // Monthly projections for display (up to deadline or 12 months)
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const displayMonths = Math.min(Math.ceil(totalDays / 30), 24);

  const monthly: { month: number; capital: number; interest_earned: number; total: number }[] = [];
  let balance = currentAmount;
  let totalInterest = 0;
  let goalReachedMonth: number | null = null;
  const freqMap: Record<string, number> = { monthly: 30, quarterly: 91, semi_annual: 182, yearly: 365 };
  const compoundDays = freqMap[frequency] || 365;
  let daysSinceCompound = 0;

  for (let m = 1; m <= displayMonths; m++) {
    balance += monthlyContribution;
    daysSinceCompound += 30;

    let monthInterest = 0;
    if (daysSinceCompound >= compoundDays) {
      monthInterest = balance * dailyRate * daysSinceCompound;
      balance += monthInterest;
      totalInterest += monthInterest;
      daysSinceCompound = 0;
    }

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

  const r1y = calcForMonths(12);
  const r3y = calcForMonths(36);
  const r5y = calcForMonths(60);

  // Estimate goal date
  let estimatedGoalDate: string | null = null;
  if (targetAmount > 0 && monthlyContribution > 0) {
    if (goalReachedMonth !== null) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + goalReachedMonth);
      estimatedGoalDate = d.toISOString().split("T")[0];
    } else {
      // Extend
      let extBal = balance;
      let extMonth = displayMonths;
      let extDays = daysSinceCompound;
      while (extBal < targetAmount && extMonth < 600) {
        extMonth++;
        extBal += monthlyContribution;
        extDays += 30;
        if (extDays >= compoundDays) {
          extBal += extBal * dailyRate * extDays;
          extDays = 0;
        }
      }
      if (extBal >= targetAmount) {
        const d = new Date(start);
        d.setMonth(d.getMonth() + extMonth);
        estimatedGoalDate = d.toISOString().split("T")[0];
      }
    }
  }

  return {
    monthly,
    interest1y: r1y.interest,
    interest3y: r3y.interest,
    interest5y: r5y.interest,
    estimatedGoalDate,
    totalDays,
    dailyRate,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      goal_name, current_amount, target_amount, monthly_contribution,
      interest_rate, interest_frequency, is_locked, bank_name, deadline, start_date, locale, currency,
    } = await req.json();
    const cur = currency || "XOF";

    let rate = Number(interest_rate) || 0;
    const monthly = Number(monthly_contribution) || 0;
    const current = Number(current_amount) || 0;
    const target = Number(target_amount) || 0;

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

    const bestRate = Math.max(...Object.values(BANK_RATES).map(v => v.rate));
    const avgRate = Object.values(BANK_RATES).filter(v => v.type.includes('classique')).reduce((s, v) => s + v.rate, 0) / Object.values(BANK_RATES).filter(v => v.type.includes('classique')).length;

    // Deterministic calculation with daily proration
    const projections = computeProrataProjections(current, monthly, rate, interest_frequency || "yearly", start_date, deadline, target);

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
- Taux d'intérêt appliqué : ${rate}% annuel (fréquence : ${interest_frequency || "annuel"})
- Bloquée : ${is_locked ? "Oui" : "Non"}
- Banque : ${bank_name || "Non précisée"}
- Date de début : ${start_date || "Aujourd'hui"}
- Date limite : ${deadline || "Pas de date limite"}
- Durée totale : ${projections.totalDays} jours
- Calcul journalier : taux/365 = ${(projections.dailyRate * 100).toFixed(6)}%/jour

Projections au prorata journalier :
- Intérêts estimés 1 an : ${projections.interest1y.toLocaleString('fr-FR')} ${cur}
- Intérêts estimés 3 ans : ${projections.interest3y.toLocaleString('fr-FR')} ${cur}
- Intérêts estimés 5 ans : ${projections.interest5y.toLocaleString('fr-FR')} ${cur}
- Mois estimés pour l'objectif : ${monthsToGoal ?? "N/A"}
- Date estimée d'atteinte : ${projections.estimatedGoalDate || "Inconnue"}

Taux de référence du marché UEMOA (épargne classique) :
${marketRates.join('\n')}
- Taux moyen marché : ${avgRate.toFixed(2)}%
- Meilleur taux disponible : ${bestRate}%
${bankRef ? `- Taux de référence ${bank_name} : ${bankRef.rate}% (${bankRef.type})` : ''}
${rate < avgRate ? `⚠️ Le taux de ${rate}% est INFÉRIEUR à la moyenne du marché (${avgRate.toFixed(2)}%)` : rate > avgRate ? `✅ Le taux de ${rate}% est SUPÉRIEUR à la moyenne du marché (${avgRate.toFixed(2)}%)` : ''}

IMPORTANT : 
- Tous les montants DOIVENT être en ${cur}, JAMAIS en EUR ou autre devise.
- Compare le taux actuel avec les taux du marché ci-dessus.
- Donne des recommandations avec des MONTANTS CHIFFRÉS et des ACTIONS CONCRÈTES.
- Si le taux est bas, recommande des alternatives avec les gains potentiels calculés.
- Évalue si la mensualité est suffisante pour atteindre l'objectif à temps.

En ${lang}, fournis :
1. Un résumé court (2-3 phrases) de la situation avec comparaison au marché
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
          { role: "system", content: `Expert financier UEMOA/CEMAC. Réponds en ${lang}. Sois précis, objectif et chiffré. TOUS les montants en ${cur}. Compare toujours au marché.` },
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
                summary: { type: "string", description: "2-3 sentence summary comparing to market rates" },
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
      monthly_projections: projections.monthly,
      interest_income_1y: projections.interest1y,
      interest_income_3y: projections.interest3y,
      interest_income_5y: projections.interest5y,
      estimated_goal_date: projections.estimatedGoalDate,
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
