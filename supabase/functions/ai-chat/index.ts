import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Tu es un conseiller financier personnel intelligent et expert intégré dans l'application Budget Planner Pro. Tu assistes l'utilisateur sur sa gestion financière, ses possibilités d'investissement, d'épargne et de remboursement de dettes.

CONTEXTE FINANCIER COMPLET DE L'UTILISATEUR :
${context ? JSON.stringify(context, null, 2) : "Non disponible"}

RÈGLES :
- Réponds dans la langue de l'utilisateur (français par défaut, anglais si demandé).
- Sois concis, précis et actionnable. Utilise des montants chiffrés basés sur les données réelles.
- Base tes conseils sur le contexte financier réel : comptes (soldes, types), budgets (montants, périodes, catégories), épargne (objectifs, taux, échéances), dettes (montants restants, échéances), transactions récurrentes (fréquences, prochaines dates) et transactions récentes.
- ANALYSE CONTEXTUELLE: Quand l'utilisateur demande un bilan ou une analyse, utilise les données summary (solde total, taux d'épargne, dette totale) pour donner des chiffres précis.
- DETTES: Si l'utilisateur a des dettes, propose des stratégies de remboursement (boule de neige vs avalanche). Calcule le revenu disponible (revenus - dépenses du mois).
- ÉPARGNE: Évalue si le taux d'épargne est suffisant (minimum recommandé: 20%). Propose des optimisations basées sur les taux d'intérêt réels des banques.
- RÉCURRENCES: Tiens compte des revenus et dépenses récurrentes pour les projections.
- Pour les investissements, tiens compte de la localisation (marché UEMOA/CEMAC si Afrique de l'Ouest/Centrale) et propose des options adaptées : DAT, comptes épargne, tontines, obligations d'État, microfinance, etc.
- Ne donne JAMAIS de garantie de rendement. Précise toujours les risques.
- Si l'utilisateur n'a pas assez de données, demande-lui de renseigner ses comptes et transactions.
- Utilise le markdown pour formater tes réponses (listes, gras, titres, tableaux).
- Pour les calculs d'intérêts, utilise le prorata journalier : intérêts = capital × (taux/365) × jours.
- Taux de référence UEMOA : SGCI (3.5%), BOA (3-4%), BICICI (3.25%), Ecobank (2.5-3.5%), Coris Bank (3.5-4%), NSIA (3-3.5%), Orabank (3-4%), BMS (3.5%), UBA (2.5-3%).`;

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
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans quelques instants." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA épuisés. Veuillez recharger votre espace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erreur du service IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
