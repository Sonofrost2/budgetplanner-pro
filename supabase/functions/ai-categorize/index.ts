import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requirePlan } from "../_shared/requirePlan.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const gate = await requirePlan(req, ["free", "pro", "premium"], {
      feature: "ai_categorize",
      freeQuota: 10,
      auditSubtype: "ai-categorize",
    });
    if (!gate.ok) return gate.response!;

    const { description, type, categories, recentTransactions, locale } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const categoryList = (categories || []).map((c: any) => `"${c.name}" (id: ${c.id})`).join(", ");
    
    // Build recent patterns for context
    const patterns = (recentTransactions || []).slice(0, 30).map((tx: any) => 
      `"${tx.description}" → catégorie: ${tx.category_name || 'aucune'}`
    ).join("\n");

    const systemPrompt = locale === 'fr'
      ? `Tu es un assistant de catégorisation financière. L'utilisateur saisit une transaction de type "${type}". En te basant sur la description et les patterns passés, attribue la catégorie la plus pertinente. Catégories disponibles: ${categoryList}.

PATTERNS RÉCENTS DE L'UTILISATEUR:
${patterns || 'Aucun pattern disponible'}

RÈGLES:
- Choisis la catégorie la plus logique
- Si aucune catégorie ne correspond bien, retourne null pour category_id
- Base-toi d'abord sur les patterns de l'utilisateur, puis sur le sens commun`
      : `You are a financial categorization assistant. The user is entering a "${type}" transaction. Based on the description and past patterns, assign the most relevant category. Available categories: ${categoryList}.

USER'S RECENT PATTERNS:
${patterns || 'No patterns available'}

RULES:
- Choose the most logical category
- If no category fits well, return null for category_id
- Base your decision first on user patterns, then on common sense`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Catégorise cette transaction: "${description}"` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "categorize_transaction",
            description: "Categorize a transaction based on its description",
            parameters: {
              type: "object",
              properties: {
                category_id: { type: "string", description: "ID of the matching category, or null" },
                confidence: { type: "number", description: "Confidence score 0-1" },
              },
              required: ["category_id", "confidence"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "categorize_transaction" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ category_id: null, confidence: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const args = typeof toolCall.function.arguments === 'string' ? JSON.parse(toolCall.function.arguments) : toolCall.function.arguments;
      return new Response(JSON.stringify(args), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ category_id: null, confidence: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-categorize error:", e);
    return new Response(JSON.stringify({ category_id: null, confidence: 0 }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
