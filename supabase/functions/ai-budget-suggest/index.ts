import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { categories, existingBudgets, transactionSummary, locale } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const lang = locale === 'fr' ? 'français' : 'English';
    const systemPrompt = `You are a financial advisor AI. Analyze the user's transaction history and suggest budgets they should create. Answer in ${lang}.`;

    const userPrompt = `Here is the user's financial data:

## Existing Categories
${JSON.stringify(categories, null, 2)}

## Existing Budgets (already created)
${JSON.stringify(existingBudgets, null, 2)}

## Transaction Summary (last 3 months, sum per category)
${JSON.stringify(transactionSummary, null, 2)}

Based on this data, suggest budgets the user should create. Focus on:
1. Categories with spending but no budget
2. Categories with recurring patterns
3. Appropriate period (daily/weekly/monthly/quarterly) based on frequency
4. Realistic amounts based on actual spending patterns

Return suggestions using the suggest_budgets function.`;

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
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_budgets",
              description: "Return budget suggestions based on transaction analysis.",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Budget name" },
                        category_id: { type: "string", description: "Category UUID" },
                        amount: { type: "number", description: "Suggested monthly amount" },
                        period: { type: "string", enum: ["daily", "weekly", "monthly", "quarterly", "semi_annual", "yearly"] },
                        budget_type: { type: "string", enum: ["expense", "income"] },
                        reason: { type: "string", description: "Why this budget is suggested" },
                      },
                      required: ["name", "category_id", "amount", "period", "budget_type", "reason"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["suggestions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_budgets" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI error", suggestions: [] }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let suggestions = [];

    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        suggestions = parsed.suggestions || [];
      } catch {
        suggestions = [];
      }
    }

    return new Response(JSON.stringify({ suggestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-budget-suggest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", suggestions: [] }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
