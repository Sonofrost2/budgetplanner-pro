import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { transactions, categories, locale } = await req.json();

    const anonymizedTransactions = (transactions || []).map((tx: any) => ({
      type: tx.type,
      amount: tx.amount,
      date: tx.date,
      category_id: tx.category_id,
      category_name: tx.categories?.name || null,
    }));

    const systemPrompt = locale === 'fr'
      ? `Tu es un expert en finances personnelles africaines/francophones. Analyse les transactions et génère :
1. Un score de santé financière (0-100) avec label
2. Des prévisions détaillées par catégorie avec tendances et conseils
3. Des projections globales sur 6 mois (3 scénarios)
4. Des alertes de risque hiérarchisées
5. Un plan d'action concret avec impact chiffré
6. Le potentiel d'épargne mensuel identifié

Sois précis, pragmatique et adapté au contexte africain/UEMOA si les montants sont en CFA. Donne des conseils actionnables et culturellement pertinents.`
      : `You are a personal finance expert. Analyze the provided transactions and generate:
1. A financial health score (0-100) with label
2. Detailed per-category forecasts with trends and advice
3. Global 6-month projections (3 scenarios)
4. Prioritized risk alerts
5. A concrete action plan with estimated impact
6. Monthly savings potential

Be precise, pragmatic, and adapted to the user's context. Give actionable advice.`;

    const userPrompt = `Transaction data (last 6 months):
${JSON.stringify(anonymizedTransactions, null, 2)}

Categories: ${JSON.stringify(categories)}

Analyze thoroughly and provide comprehensive forecasts with health score, risk alerts, and action plan.`;

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
            name: "generate_forecast",
            description: "Generate comprehensive financial forecasts with health score, risk alerts, category insights, and action plan",
            parameters: {
              type: "object",
              properties: {
                analysis: {
                  type: "object",
                  properties: {
                    avg_monthly_income: { type: "number" },
                    avg_monthly_expenses: { type: "number" },
                    savings_rate: { type: "number", description: "Percentage 0-100" },
                    health_score: { type: "number", description: "Financial health score 0-100" },
                    health_label: { type: "string", enum: ["Excellent", "Bon", "Fragile", "Critique"], description: "Health label" },
                    monthly_savings_potential: { type: "number", description: "Identified monthly savings potential amount" },
                    top_expense_categories: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          amount: { type: "number" },
                          percentage: { type: "number" },
                        },
                        required: ["name", "amount", "percentage"],
                      },
                    },
                    trends: { type: "string", description: "Brief analysis of spending trends" },
                    recommendations: { type: "array", items: { type: "string" } },
                  },
                  required: ["avg_monthly_income", "avg_monthly_expenses", "savings_rate", "health_score", "health_label", "monthly_savings_potential", "top_expense_categories", "trends", "recommendations"],
                },
                risk_alerts: {
                  type: "array",
                  description: "Prioritized risk alerts",
                  items: {
                    type: "object",
                    properties: {
                      message: { type: "string" },
                      severity: { type: "string", enum: ["high", "medium", "low"] },
                    },
                    required: ["message", "severity"],
                  },
                },
                detailed_forecasts: {
                  type: "array",
                  description: "Per-category monthly forecasts with insights",
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string" },
                      trend: { type: "string", enum: ["up", "down", "stable"] },
                      advice: { type: "string", description: "Personalized advice for this category" },
                      avg_last_3m: { type: "number", description: "Average spending last 3 months" },
                      projected_next_month: { type: "number", description: "Projected amount next month" },
                      monthly_projections: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            month: { type: "string" },
                            optimistic: { type: "number" },
                            realistic: { type: "number" },
                            pessimistic: { type: "number" },
                          },
                          required: ["month", "optimistic", "realistic", "pessimistic"],
                        },
                      },
                    },
                    required: ["category", "trend", "advice", "avg_last_3m", "projected_next_month", "monthly_projections"],
                  },
                },
                global_forecasts: {
                  type: "array",
                  description: "Global monthly balance projections for next 6 months",
                  items: {
                    type: "object",
                    properties: {
                      month: { type: "string" },
                      optimistic_balance: { type: "number" },
                      realistic_balance: { type: "number" },
                      pessimistic_balance: { type: "number" },
                      optimistic_income: { type: "number" },
                      realistic_income: { type: "number" },
                      pessimistic_income: { type: "number" },
                      optimistic_expenses: { type: "number" },
                      realistic_expenses: { type: "number" },
                      pessimistic_expenses: { type: "number" },
                    },
                    required: ["month", "optimistic_balance", "realistic_balance", "pessimistic_balance"],
                  },
                },
                action_plan: {
                  type: "array",
                  description: "3-5 concrete actions with estimated impact",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      description: { type: "string" },
                      impact_amount: { type: "number", description: "Estimated monthly savings/gain" },
                      difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                    },
                    required: ["title", "description", "impact_amount", "difficulty"],
                  },
                },
              },
              required: ["analysis", "risk_alerts", "detailed_forecasts", "global_forecasts", "action_plan"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_forecast" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "No forecast generated" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const forecast = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(forecast), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("forecast error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
