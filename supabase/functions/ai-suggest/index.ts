import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requirePlan } from "../_shared/requirePlan.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // All plans allowed; free gets 10 suggestions/day to taste
    const gate = await requirePlan(req, ["free", "pro", "premium"], {
      feature: "ai_suggest",
      freeQuota: 10,
      auditSubtype: "ai-suggest",
    });
    if (!gate.ok) return gate.response!;

    const { description, type, categories, accounts, locale } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const categoryList = (categories || []).map((c: any) => `${c.name} (id: ${c.id})`).join(", ");
    const accountList = (accounts || []).map((a: any) => `${a.name} (id: ${a.id})`).join(", ");

    const systemPrompt = locale === 'fr'
      ? `Tu es un assistant financier. L'utilisateur saisit une transaction de type "${type}". Suggère une description complète, une catégorie et un montant estimé basé sur le contexte. Catégories disponibles: ${categoryList}. Comptes disponibles: ${accountList}.`
      : `You are a financial assistant. The user is entering a "${type}" transaction. Suggest a complete description, category and estimated amount. Available categories: ${categoryList}. Available accounts: ${accountList}.`;

    const userPrompt = description
      ? (locale === 'fr' ? `L'utilisateur a commencé à taper: "${description}". Complète et suggère.` : `The user started typing: "${description}". Complete and suggest.`)
      : (locale === 'fr' ? `Suggère une transaction typique de type ${type}.` : `Suggest a typical ${type} transaction.`);

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
              name: "suggest_transaction",
              description: "Suggest transaction details",
              parameters: {
                type: "object",
                properties: {
                  description: { type: "string", description: "Suggested transaction description" },
                  category_id: { type: "string", description: "ID of the suggested category" },
                  amount: { type: "number", description: "Suggested amount" },
                  account_id: { type: "string", description: "ID of the suggested account" },
                },
                required: ["description"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_transaction" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const args = typeof toolCall.function.arguments === 'string' ? JSON.parse(toolCall.function.arguments) : toolCall.function.arguments;
      return new Response(JSON.stringify(args), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ description: description || "" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("ai-suggest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
