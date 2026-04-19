import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requirePlan } from "../_shared/requirePlan.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const gate = await requirePlan(req, ["free", "pro", "premium"], {
      feature: "ai_quick_parse",
      freeQuota: 10,
      auditSubtype: "ai-quick-parse",
    });
    if (!gate.ok) return gate.response!;

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
      ? `Tu es un assistant qui parse une saisie rapide en langage naturel et la transforme en structure.

Règles :
- Détecte le type :
  • "transfer" si la phrase indique un mouvement entre 2 comptes (mots-clés : "transfert", "transférer", "vire", "virement", "envoyer/envoie X vers Y", "de X à Y", "X → Y", "passer de X à Y", "déplacer/déposer X vers Y").
  • "income" si revenu/salaire/vente/reçu.
  • "expense" sinon (par défaut).
- Extrait le montant (nombre uniquement, pas de devise). Tolère espaces, virgules, "k" pour milliers.
- Génère une description courte et claire (capitalisée). Pour un transfert : "Transfert <Source> → <Destination>".
- Pour expense/income : choisis l'ID de la catégorie la plus pertinente (UUID exact) + l'ID du compte (par défaut le premier listé).
- Pour transfer : remplis "from_account_id" (compte source) et "to_account_id" (compte destination), tous deux UUID exacts. Ne renvoie PAS de category_id ni d'account_id pour un transfert.

Catégories dépenses : ${expenseCats || "(aucune)"}
Catégories revenus : ${incomeCats || "(aucune)"}
Comptes : ${accountList || "(aucun)"}`
      : `You parse a quick natural-language entry into a structured payload.

Rules:
- Detect type:
  • "transfer" if the sentence describes a movement between 2 accounts (keywords: "transfer", "send X to Y", "from X to Y", "X → Y", "move X to Y").
  • "income" if salary/sale/payment received.
  • "expense" otherwise (default).
- Extract the amount (number only, no currency). Tolerate spaces, commas, "k" for thousands.
- Short clean description (capitalized). For a transfer: "Transfer <Source> → <Destination>".
- For expense/income: pick best category UUID + account UUID (default first).
- For transfer: fill "from_account_id" and "to_account_id" (exact UUIDs). Do NOT return category_id or account_id for a transfer.

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
                  type: { type: "string", enum: ["expense", "income", "transfer"] },
                  category_id: { type: "string", description: "UUID of the category (expense/income only)" },
                  account_id: { type: "string", description: "UUID of the account (expense/income only)" },
                  from_account_id: { type: "string", description: "UUID of the source account (transfer only)" },
                  to_account_id: { type: "string", description: "UUID of the destination account (transfer only)" },
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
