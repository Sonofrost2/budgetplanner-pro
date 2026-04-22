import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requirePlan } from "../_shared/requirePlan.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Tu es **Coach Financier**, un conseiller personnel chaleureux, proactif et expert intégré dans Budget Planner Pro.

🎯 PERSONA
- Ton chaleureux, encourageant, jamais culpabilisant. Tu félicites les efforts.
- Tu parles à la 2e personne (tu/vous selon le contexte) avec une touche complice.
- Tu vas droit au but : pas de blabla, des chiffres réels, des conseils actionnables.

📋 FORMAT DE RÉPONSE (OBLIGATOIRE)
- **Markdown systématique** : titres ##, listes à puces, **gras** sur les chiffres clés, tableaux pour les comparaisons.
- **~250 mots maximum** sauf si l'utilisateur demande explicitement une analyse approfondie.
- **Toujours conclure** par une section "✨ Ce que je te suggère" avec 1-2 actions concrètes chiffrées.

⚡ ACTIONS INLINE (très important)
Quand pertinent, propose des actions cliquables en utilisant ces tags exactement (ils seront remplacés par des boutons) :
- \`[ACTION:create_budget|Catégorie|Montant]\` — pour créer un cadre de dépense
- \`[ACTION:create_savings_goal|Nom|Cible]\` — pour créer un objectif d'épargne
- \`[ACTION:view_module|budgets|transactions|savings|debts|wealth|recurring]\` — pour ouvrir un module

Exemple : "Tu pourrais cadrer tes loisirs à 50 000 FCFA. [ACTION:create_budget|Loisirs|50000]"

📊 RÈGLES MÉTIER
- Base TOUS tes conseils sur le contexte réel (summary, accounts, budgets, savings, debts, recurring, recentTransactions).
- Si l'utilisateur demande un bilan : utilise summary.totalBalance, savingsRate, totalDebt + variations vs mois précédent si visibles.
- Dettes : propose boule de neige (plus petite d'abord) ou avalanche (taux le plus haut). Calcule le revenu disponible.
- Épargne : minimum recommandé 20%. Compare aux taux des banques UEMOA si pertinent.
- Récurrences : intègre les revenus/dépenses récurrents dans les projections.
- Taux UEMOA : SGCI 3.5%, BOA 3-4%, BICICI 3.25%, Ecobank 2.5-3.5%, Coris 3.5-4%, NSIA 3-3.5%.
- Investissements : adapte au marché (UEMOA/CEMAC) — DAT, tontines, obligations d'État, microfinance, etc.
- JAMAIS de garantie de rendement. Précise toujours les risques.

🌍 LANGUE
- Réponds dans la langue du dernier message utilisateur (FR par défaut).`;

const MODEL_FALLBACKS = [
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
];

async function callLovableAI(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  options: { stream?: boolean; preferredModel?: string } = {},
) {
  const models = [
    options.preferredModel,
    ...MODEL_FALLBACKS.filter((model) => model !== options.preferredModel),
  ].filter(Boolean) as string[];

  let lastErrorText = "";
  let lastStatus = 500;

  for (const model of models) {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        stream: options.stream ?? false,
      }),
    });

    if (response.ok) return response;

    const errorText = await response.text();
    lastErrorText = errorText;
    lastStatus = response.status;

    const shouldTryFallback = [404, 410, 503].includes(response.status)
      || /model|deprecated|unavailable|not found/i.test(errorText);

    if (shouldTryFallback) {
      console.warn(`ai-chat fallback from ${model}:`, response.status, errorText);
      continue;
    }

    return { response, errorText };
  }

  return { response: null, errorText: lastErrorText, status: lastStatus };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Plan gate: pro/premium only, free gets 5 messages/day to taste
    const gate = await requirePlan(req, ["pro", "premium"], {
      feature: "ai_chat",
      freeQuota: 5,
      auditSubtype: "ai-chat",
    });
    if (!gate.ok) return gate.response!;
    const userId = gate.userId!;

    const { messages, context, conversationId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Persist user message immediately if we have userId + conversationId
    let convId = conversationId as string | undefined;
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user");

    if (userId && lastUserMsg) {
      if (!convId) {
        const { data: newConv } = await admin
          .from("ai_conversations")
          .insert({ user_id: userId, title: lastUserMsg.content.slice(0, 60) })
          .select("id")
          .single();
        convId = newConv?.id;
      }
      if (convId) {
        await admin.from("ai_messages").insert({
          conversation_id: convId,
          user_id: userId,
          role: "user",
          content: lastUserMsg.content,
        });
      }
    }

    const systemContent = `${SYSTEM_PROMPT}\n\nCONTEXTE FINANCIER UTILISATEUR :\n${context ? JSON.stringify(context, null, 2) : "Non disponible"}`;

    const aiResult = await callLovableAI(
      LOVABLE_API_KEY,
      [{ role: "system", content: systemContent }, ...messages],
      { stream: true, preferredModel: "google/gemini-3-flash-preview" },
    );

    const response = aiResult instanceof Response ? aiResult : aiResult.response;
    if (!response?.ok) {
      const status = response?.status ?? aiResult.status ?? 500;
      const errorText = "errorText" in aiResult ? aiResult.errorText : "";

      if (status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans quelques instants." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA épuisés. Veuillez recharger votre espace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway error:", status, errorText);
      return new Response(JSON.stringify({ error: "Le service IA est temporairement indisponible. Réessaie dans un instant." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tee the stream: forward to client AND accumulate to persist + auto-title
    const [clientStream, persistStream] = response.body!.tee();

    if (userId && convId) {
      (async () => {
        try {
          const reader = persistStream.getReader();
          const decoder = new TextDecoder();
          let buf = ""; let full = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let idx: number;
            while ((idx = buf.indexOf("\n")) !== -1) {
              let line = buf.slice(0, idx); buf = buf.slice(idx + 1);
              if (line.endsWith("\r")) line = line.slice(0, -1);
              if (!line.startsWith("data: ")) continue;
              const json = line.slice(6).trim();
              if (json === "[DONE]") continue;
              try {
                const parsed = JSON.parse(json);
                const c = parsed.choices?.[0]?.delta?.content;
                if (c) full += c;
              } catch { /* partial */ }
            }
          }
          if (full.trim()) {
            await admin.from("ai_messages").insert({
              conversation_id: convId,
              user_id: userId,
              role: "assistant",
              content: full,
            });

            // Auto-generate title after 2nd exchange (1 user + 1 assistant just inserted = 2 msgs total = first exchange done)
            const { count } = await admin
              .from("ai_messages")
              .select("id", { count: "exact", head: true })
              .eq("conversation_id", convId);
            if ((count || 0) === 2) {
              try {
                const titleResp = await callLovableAI(
                  LOVABLE_API_KEY,
                  [
                    { role: "system", content: "Génère un titre court (3-5 mots, sans guillemets, sans ponctuation finale) résumant ce premier échange financier." },
                    { role: "user", content: `Q: ${lastUserMsg.content.slice(0, 200)}\nR: ${full.slice(0, 400)}` },
                  ],
                  { preferredModel: "google/gemini-2.5-flash-lite" },
                );
                if (titleResp instanceof Response && titleResp.ok) {
                  const tj = await titleResp.json();
                  const title = (tj.choices?.[0]?.message?.content || "").trim().replace(/^["']|["']$/g, "").slice(0, 80);
                  if (title) await admin.from("ai_conversations").update({ title }).eq("id", convId);
                }
              } catch (e) { console.error("title gen failed", e); }
            }
          }
        } catch (e) { console.error("persist stream error", e); }
      })();
    }

    return new Response(clientStream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "x-conversation-id": convId || "" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
