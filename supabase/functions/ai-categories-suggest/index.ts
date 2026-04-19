import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CatPayload {
  id: string;
  name: string;
  type: string;
  parent_id: string | null;
  tx_count: number;
  total: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { categories, locale = 'fr' } = await req.json() as { categories: CatPayload[]; locale?: 'fr' | 'en' };
    if (!Array.isArray(categories) || categories.length === 0) {
      return new Response(JSON.stringify({ suggestions: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY missing');

    const sysFr = `Tu es un coach financier expert en taxonomie. Analyse la liste de catégories d'un utilisateur et propose au maximum 6 suggestions concrètes.
Types possibles :
- "duplicate" : 2+ catégories ressemblent sémantiquement (ex: "Bouffe" / "Alimentation"). Suggère de fusionner.
- "unused" : catégories sans transaction depuis longtemps. Suggère d'archiver.
- "reparent" : sous-catégorie logique (ex: "Essence" sous "Transport").
- "split" : catégorie trop générique qui mériterait d'être divisée.

Réponds UNIQUEMENT en JSON strict : { "suggestions": [{ "type": "duplicate"|"unused"|"reparent"|"split", "title": "...", "description": "..." }] }
Sois concis (titre 6 mots max, description 18 mots max). Pas de markdown.`;

    const sysEn = `You are a financial coach expert in taxonomy. Analyze the user's category list and propose at most 6 concrete suggestions.
Types: "duplicate", "unused", "reparent", "split". Reply ONLY as strict JSON: { "suggestions": [{ "type": "...", "title": "...", "description": "..." }] }. Be concise (title ≤6 words, description ≤18 words). No markdown.`;

    const userMsg = `Catégories:\n${categories.map(c => `- ${c.name} (${c.type}, parent=${c.parent_id ?? 'root'}, tx=${c.tx_count}, total=${c.total})`).join('\n')}`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: locale === 'fr' ? sysFr : sysEn },
          { role: 'user', content: userMsg },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: 'Rate limit' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: 'Credits exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!aiRes.ok) {
      const txt = await aiRes.text();
      throw new Error(`AI gateway: ${aiRes.status} ${txt.slice(0, 200)}`);
    }

    const data = await aiRes.json();
    const content = data?.choices?.[0]?.message?.content ?? '{"suggestions":[]}';
    let parsed: any = { suggestions: [] };
    try { parsed = JSON.parse(content); } catch { /* ignore */ }
    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 6) : [];

    return new Response(JSON.stringify({ suggestions }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('ai-categories-suggest error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
