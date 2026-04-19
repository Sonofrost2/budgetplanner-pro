import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requirePlan } from "../_shared/requirePlan.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const gate = await requirePlan(req, ["premium"], { feature: "ai_report_insights", auditSubtype: "ai-report-insights" });
    if (!gate.ok) return gate.response!;

    const { monthlyData, categoryData, savingsProgress, budgetPerformance, debtsOverview, locale } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const lang = locale === 'fr' ? 'français' : 'English';
    const systemPrompt = `Tu es un analyste financier expert. Analyse les données financières de l'utilisateur et génère un rapport d'insights intelligent avec des recommandations actionnables. Réponds en ${lang}.

RÈGLES:
- Identifie les tendances (hausse/baisse des revenus/dépenses)
- Détecte les anomalies (pics de dépenses, catégories inhabituelles)
- Calcule le taux d'épargne et compare aux recommandations (20% minimum)
- Évalue la santé financière globale sur 100
- Donne 3-5 recommandations prioritaires et concrètes
- Contexte africain/UEMOA si montants en CFA`;

    const userPrompt = `Données financières:

## Revenus/Dépenses mensuels (12 mois):
${JSON.stringify(monthlyData, null, 2)}

## Top dépenses par catégorie (mois courant):
${JSON.stringify(categoryData, null, 2)}

## Progression épargne:
${JSON.stringify(savingsProgress || 'Non renseigné', null, 2)}

## Performance budgets:
${JSON.stringify(budgetPerformance || 'Non renseigné', null, 2)}

## Dettes:
${JSON.stringify(debtsOverview || 'Aucune dette', null, 2)}

Analyse et génère un rapport d'insights.`;

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
            name: "generate_insights",
            description: "Generate financial insights report",
            parameters: {
              type: "object",
              properties: {
                health_score: { type: "number", description: "Financial health score 0-100" },
                health_label: { type: "string", enum: ["excellent", "good", "fair", "poor", "critical"] },
                savings_rate: { type: "number", description: "Current savings rate %" },
                monthly_trend: { type: "string", enum: ["improving", "stable", "declining"] },
                key_insights: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      icon: { type: "string", description: "Emoji icon" },
                      title: { type: "string" },
                      description: { type: "string" },
                      type: { type: "string", enum: ["positive", "warning", "danger", "info"] },
                    },
                    required: ["icon", "title", "description", "type"],
                  },
                },
                recommendations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      priority: { type: "number", description: "1 = highest" },
                      action: { type: "string" },
                      expected_impact: { type: "string" },
                    },
                    required: ["priority", "action", "expected_impact"],
                  },
                },
                anomalies: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string" },
                      description: { type: "string" },
                      severity: { type: "string", enum: ["low", "medium", "high"] },
                    },
                    required: ["category", "description", "severity"],
                  },
                },
                summary: { type: "string", description: "2-3 sentence executive summary" },
              },
              required: ["health_score", "health_label", "savings_rate", "monthly_trend", "key_insights", "recommendations", "summary"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_insights" } },
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
      const insights = typeof toolCall.function.arguments === 'string' ? JSON.parse(toolCall.function.arguments) : toolCall.function.arguments;
      return new Response(JSON.stringify(insights), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "No insights generated" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-report-insights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
