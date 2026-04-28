import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requirePlan } from "../_shared/requirePlan.ts";
import { annualInterestCost, annualizeRate } from "../_shared/financialNormalization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const gate = await requirePlan(req, ["premium"], { feature: "ai_debt_plan", auditSubtype: "ai-debt-plan" });
    if (!gate.ok) return gate.response!;

    const { debts, monthlyIncome, monthlyExpenses, locale } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Enrichissement : on calcule les coûts annuels d'intérêt AVANT d'envoyer
    // à l'IA. Sinon elle compare des taux mensuels et annuels sans le savoir.
    const enrichedDebts = (debts || []).map((d: any) => {
      const rateRaw = Number(d.interestRatePct ?? d.interest_rate ?? 0);
      const annualRate = annualizeRate(rateRaw, "yearly");
      const remaining = Number(d.remaining ?? (Number(d.total) - Number(d.paid)));
      return {
        ...d,
        annual_rate_pct: annualRate,
        annual_interest_cost: annualInterestCost(remaining, annualRate, d.interestType || d.interest_type),
        remaining,
      };
    });
    // Tri par coût d'intérêt annuel décroissant — utile pour avalanche.
    const debtsByAvalanche = [...enrichedDebts].sort((a, b) => b.annual_interest_cost - a.annual_interest_cost);
    const debtsBySnowball = [...enrichedDebts].sort((a, b) => a.remaining - b.remaining);

    const lang = locale === 'fr' ? 'français' : 'English';
    const systemPrompt = `Tu es un expert en finances personnelles spécialisé dans le remboursement de dettes. Analyse les dettes de l'utilisateur et propose un plan de remboursement optimal. Réponds en ${lang}.

RÈGLES:
- Compare les méthodes "Boule de neige" (plus PETIT capital restant d'abord) et "Avalanche" (PLUS HAUT coût d'intérêt annuel d'abord)
- Les taux fournis sont DÉJÀ ANNUALISÉS — ne les reconvertis pas
- annual_interest_cost = coût d'intérêt sur 1 an au taux courant ; c'est l'arbitre pour avalanche
- Tiens compte du revenu disponible (revenus - dépenses)
- Propose des montants réalistes de remboursement mensuel
- Indique la date estimée de fin de remboursement total
- Donne des conseils pratiques pour accélérer le remboursement
- Si le revenu disponible est négatif, alerte l'utilisateur`;

    const userPrompt = `Voici la situation de l'utilisateur:

## Revenus mensuels moyens: ${monthlyIncome}
## Dépenses mensuelles moyennes: ${monthlyExpenses}
## Revenu disponible: ${monthlyIncome - monthlyExpenses}

## Dettes en cours (taux DÉJÀ annualisés, coût d'intérêt annuel pré-calculé):
${JSON.stringify(enrichedDebts, null, 2)}

## Ordre AVALANCHE (coût d'intérêt décroissant):
${debtsByAvalanche.map((d: any, i: number) => `${i + 1}. ${d.creditor} — ${d.annual_rate_pct}% ann., coût annuel ≈ ${d.annual_interest_cost}, restant ${d.remaining}`).join("\n")}

## Ordre BOULE DE NEIGE (capital restant croissant):
${debtsBySnowball.map((d: any, i: number) => `${i + 1}. ${d.creditor} — restant ${d.remaining}, coût annuel ≈ ${d.annual_interest_cost}`).join("\n")}

Propose un plan de remboursement optimal.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_debt_plan",
            description: "Generate a debt repayment plan",
            parameters: {
              type: "object",
              properties: {
                recommended_method: { type: "string", enum: ["snowball", "avalanche", "hybrid"], description: "Recommended repayment method" },
                monthly_payment: { type: "number", description: "Recommended total monthly payment towards debts" },
                total_months: { type: "number", description: "Estimated total months to be debt-free" },
                estimated_completion: { type: "string", description: "Estimated debt-free date (YYYY-MM)" },
                priority_order: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      creditor: { type: "string" },
                      monthly_payment: { type: "number" },
                      remaining: { type: "number" },
                      months_to_payoff: { type: "number" },
                      priority: { type: "number", description: "1 = highest priority" },
                    },
                    required: ["creditor", "monthly_payment", "remaining", "months_to_payoff", "priority"],
                  },
                },
                tips: { type: "array", items: { type: "string" }, description: "Practical tips" },
                summary: { type: "string", description: "Brief summary of the plan" },
              },
              required: ["recommended_method", "monthly_payment", "total_months", "estimated_completion", "priority_order", "tips", "summary"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_debt_plan" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const plan = typeof toolCall.function.arguments === 'string' ? JSON.parse(toolCall.function.arguments) : toolCall.function.arguments;
      return new Response(JSON.stringify(plan), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "No plan generated" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-debt-plan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
