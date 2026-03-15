import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { goal_name, current_amount, target_amount, monthly_contribution, interest_rate, interest_frequency, is_locked, bank_name, deadline, locale } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const lang = locale === "fr" ? "français" : "English";

    const prompt = `Tu es un conseiller financier expert en épargne. Analyse cette épargne et fais une simulation détaillée.

Données de l'objectif d'épargne :
- Nom : ${goal_name}
- Montant actuel : ${current_amount}
- Objectif : ${target_amount}
- Cotisation mensuelle prévue : ${monthly_contribution || "Non définie"}
- Taux d'intérêt : ${interest_rate || 0}%
- Fréquence de calcul des intérêts : ${interest_frequency || "annuel"}
- Épargne bloquée : ${is_locked ? "Oui" : "Non"}
- Banque : ${bank_name || "Non précisée"}
- Date limite : ${deadline || "Pas de date limite"}

Réponds en ${lang}. Fournis :
1. Une projection mois par mois sur 12 mois du solde (capital + intérêts composés)
2. Le revenu total d'intérêts estimé sur 1 an, 3 ans, 5 ans
3. La date estimée d'atteinte de l'objectif si applicable
4. Des recommandations pour optimiser cette épargne (ajuster la mensualité, changer de fréquence d'intérêts, etc.)
5. Une comparaison entre épargne bloquée vs disponible si pertinent`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Tu es un conseiller financier expert. Réponds avec des données chiffrées précises et des tableaux quand c'est pertinent." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "savings_simulation",
              description: "Return a structured savings simulation with projections",
              parameters: {
                type: "object",
                properties: {
                  monthly_projections: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        month: { type: "number" },
                        capital: { type: "number" },
                        interest_earned: { type: "number" },
                        total: { type: "number" },
                      },
                      required: ["month", "capital", "interest_earned", "total"],
                    },
                  },
                  interest_income_1y: { type: "number" },
                  interest_income_3y: { type: "number" },
                  interest_income_5y: { type: "number" },
                  estimated_goal_date: { type: "string" },
                  recommendations: {
                    type: "array",
                    items: { type: "string" },
                  },
                  summary: { type: "string" },
                },
                required: ["monthly_projections", "interest_income_1y", "interest_income_3y", "interest_income_5y", "recommendations", "summary"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "savings_simulation" } },
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
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in response");

    const simulation = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(simulation), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-savings-simulate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
