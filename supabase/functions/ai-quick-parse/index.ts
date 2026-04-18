import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { input, categories, accounts, locale } = await req.json();
    if (!input || typeof input !== "string" || input.trim().length === 0) {
      return new Response(JSON.stringify({ error: "input required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (input.length > 500) {
      return new Response(JSON.stringify({ error: "input too long" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const expenseCats = (categories || [])
      .filter((c: any) => c.type === "expense")
      .map((c: any) => `${c.name} (id: ${c.id})`)
      .join(", ");
    const incomeCats = (categories || [])
      .filter((c: any) => c.type === "income")
      .map((c: any) => `${c.name} (id: ${c.id})`)
      .join(", ");
    const accountList = (accounts || [])
      .map((a: any) => `${a.name} (id: ${a.id})`)
      .join(", ");

    const isFr = locale === "fr";
    const systemPrompt = isFr
      ? `Tu es un assistant qui parse une saisie rapide de transaction en langage naturel et la transforme en structure.

Règles :
- Détecte le type : "income" si revenu/salaire/vente/reçu, sinon "expense" par défaut.
- Extrait le montant (nombre uniquement, pas de devise). Tolère les espaces, virgules, "k" pour milliers.
- Génère une description courte et claire (capitalisée).
- Choisis l'ID de la catégorie la plus pertinente parmi celles fournies (renvoie l'UUID exact).
- Choisis l'ID du compte le plus pertinent (par défaut le premier listé si rien n'est mentionné).

Catégories dépenses : ${expenseCats || "(aucune)"}
Catégories revenus : ${incomeCats || "(aucune)"}
Comptes : ${accountList || "(aucun)"}`
      : `You parse a quick natural-language transaction entry into a structured payload.

Rules:
- Detect type: "income" if salary/sale/payment received, else "expense" by default.
- Extract the amount (number only, no currency). Tolerate spaces, commas, "k" for thousands.
- Generate a short clean description (capitalized).
- Pick the best matching category UUID from the list.
- Pick the best matching account UUID (default to first listed if not mentioned).

Expense categories: ${expenseCats || "(none)"}
Income categories: ${incomeCats || "(none)"}
Accounts: ${accountList || "(none)"}`;

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
          { role: "user", content: input },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "parse_transaction",
              description: "Parse natural-language transaction input into structured fields",
              parameters: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  amount: { type: "number" },
                  type: { type: "string", enum: ["expense", "income"] },
                  category_id: { type: "string" },
                  account_id: { type: "string" },
                  confidence: { type: "number", description: "0..1 confidence in extraction" },
                },
                required: ["description", "amount", "type"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "parse_transaction" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: isFr ? "Trop de requêtes, réessaie dans un instant." : "Rate limit exceeded, retry shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: isFr ? "Crédit IA épuisé." : "AI credits exhausted." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const errText = await response.text();
      console.error("ai-quick-parse gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "No structured output" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const args = typeof toolCall.function.arguments === "string"
      ? JSON.parse(toolCall.function.arguments)
      : toolCall.function.arguments;

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-quick-parse error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
