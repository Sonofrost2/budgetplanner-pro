import { corsHeaders } from "@supabase/supabase-js/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { asset, valuations, locale } = await req.json();
    const isFr = locale === "fr";

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const prompt = `You are a wealth management advisor. Based on the asset information and its valuation history, suggest a realistic current market value.

Asset:
- Name: ${asset.name}
- Type: ${asset.type}
- Category: ${asset.category}
- Location: ${asset.location || "N/A"}
- Acquisition cost: ${asset.acquisition_cost}
- Current value: ${asset.current_value}
- Acquisition date: ${asset.acquisition_date || "N/A"}

Valuation history (${valuations?.length || 0} entries):
${(valuations || []).map((v: any) => `  ${v.date}: ${v.value}`).join("\n")}

Respond in ${isFr ? "French" : "English"} with ONLY a JSON object:
{
  "suggested_value": <number>,
  "reasoning": "<brief explanation of the valuation>",
  "trend": "up" | "down" | "stable",
  "confidence": <0-1>
}`;

    const response = await fetch("https://ai.lovable.dev/api/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a wealth valuation expert. Always respond with valid JSON only." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI API error: ${response.status} ${errText}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-wealth-valuation error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
