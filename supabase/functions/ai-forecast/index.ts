import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // JWT validation
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

    // Anonymize transaction descriptions before sending to AI
    const anonymizedTransactions = (transactions || []).map((tx: any) => ({
      type: tx.type,
      amount: tx.amount,
      date: tx.date,
      category_id: tx.category_id,
      category_name: tx.categories?.name || null,
    }));

    const systemPrompt = locale === 'fr'
      ? `Tu es un expert en finances personnelles. Analyse les transactions fournies et génère des prévisions financières détaillées et globales sur 6 mois. Sois précis, pragmatique et adapté au contexte africain/francophone si les montants sont en CFA.`
      : `You are a personal finance expert. Analyze the provided transactions and generate detailed and global financial forecasts for 6 months. Be precise, pragmatic, and adapted to the user's context.`;

    const userPrompt = `Here is the user's transaction data (last 6 months):
${JSON.stringify(anonymizedTransactions, null, 2)}

Categories: ${JSON.stringify(categories)}

Please analyze and provide forecasts.`;

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
            description: "Generate financial forecasts with analysis, detailed per-category projections, and global projections",
            parameters: {
              type: "object",
              properties: {
                analysis: {
                  type: "object",
                  properties: {
                    avg_monthly_income: { type: "number" },
                    avg_monthly_expenses: { type: "number" },
                    savings_rate: { type: "number", description: "Percentage 0-100" },
                    top_expense_categories: { type: "array", items: { type: "object", properties: { name: { type: "string" }, amount: { type: "number" }, percentage: { type: "number" } }, required: ["name", "amount", "percentage"] } },
                    trends: { type: "string", description: "Brief analysis of spending trends" },
                    recommendations: { type: "array", items: { type: "string" } },
                  },
                  required: ["avg_monthly_income", "avg_monthly_expenses", "savings_rate", "top_expense_categories", "trends", "recommendations"],
                },
                detailed_forecasts: {
                  type: "array",
                  description: "Per-category monthly forecasts for next 6 months",
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string" },
                      monthly_projections: { type: "array", items: { type: "object", properties: { month: { type: "string" }, optimistic: { type: "number" }, realistic: { type: "number" }, pessimistic: { type: "number" } }, required: ["month", "optimistic", "realistic", "pessimistic"] } },
                    },
                    required: ["category", "monthly_projections"],
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
              },
              required: ["analysis", "detailed_forecasts", "global_forecasts"],
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
