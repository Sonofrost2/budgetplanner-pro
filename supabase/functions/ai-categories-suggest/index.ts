import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { requirePlan } from "../_shared/requirePlan.ts";

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

interface ProposedCategory {
  name: string;
  icon: string;
  color: string;
  type: 'expense' | 'income';
  parent_name?: string | null;
  rationale?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const gate = await requirePlan(req, ["pro", "premium"], { feature: "ai_categories_suggest", auditSubtype: "ai-categories-suggest" });
    if (!gate.ok) return gate.response!;

    const body = await req.json() as {
      mode?: 'coach' | 'propose';
      categories: CatPayload[];
      locale?: 'fr' | 'en';
      context?: { currency?: string; country?: string };
    };
    const { categories, locale = 'fr' } = body;
    const mode = body.mode ?? 'coach';
    if (!Array.isArray(categories)) {
      return new Response(JSON.stringify({ suggestions: [], proposals: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY missing');

    // ---- Cache lookup (shared, 24h TTL for coach, 7d for propose) ----
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const sig = categories
      .map(c => `${c.name.toLowerCase().trim()}|${c.type}|${c.parent_id ?? ''}|${c.tx_count}`)
      .sort()
      .join(';');
    const ctxKey = mode === 'propose' ? `::${body.context?.currency ?? ''}::${body.context?.country ?? ''}` : '';
    const cacheKey = `cat-suggest::${mode}::${locale}${ctxKey}::${sig}`;
    if (sig.length > 0) {
      const { data: cached } = await admin
        .from('ai_cache')
        .select('response, id')
        .eq('cache_key', cacheKey)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      if (cached?.response) {
        return new Response(JSON.stringify({ ...(cached.response as any), cached: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ---- Propose mode: return ready-to-create categories ----
    if (mode === 'propose') {
      const existing = categories.map(c => `${c.name} (${c.type})`).join(', ') || (locale === 'fr' ? 'aucune' : 'none');
      const currency = body.context?.currency || 'XOF';
      const sys = locale === 'fr'
        ? `Tu es un coach financier. Propose 6 à 10 catégories utiles et NON DUPLIQUÉES avec l'existant, adaptées au contexte (devise ${currency}, contexte ouest-africain quand pertinent).
Retourne JSON strict UNIQUEMENT :
{ "proposals": [ { "name": "...", "icon": "🍽️", "color": "#RRGGBB", "type": "expense"|"income", "parent_name": null|"NomExistant", "rationale": "..." } ] }
Contraintes: name ≤ 20 caractères, icon = 1 emoji, color = hex 6, parent_name doit exister dans la liste existante sinon null, rationale ≤ 12 mots.`
        : `You are a financial coach. Propose 6-10 useful categories NOT DUPLICATED with existing, adapted to context (currency ${currency}).
Return strict JSON ONLY:
{ "proposals": [ { "name": "...", "icon": "🍽️", "color": "#RRGGBB", "type": "expense"|"income", "parent_name": null|"ExistingName", "rationale": "..." } ] }
Constraints: name ≤ 20 chars, icon = 1 emoji, color = hex 6, parent_name must exist in list otherwise null, rationale ≤ 12 words.`;
      const usr = (locale === 'fr' ? 'Catégories existantes : ' : 'Existing categories: ') + existing;

      const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LOVABLE_API_KEY}` },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'system', content: sys }, { role: 'user', content: usr }],
          response_format: { type: 'json_object' },
        }),
      });
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: 'Rate limit' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: 'Credits exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (!aiRes.ok) throw new Error(`AI gateway: ${aiRes.status}`);
      const data = await aiRes.json();
      const content = data?.choices?.[0]?.message?.content ?? '{"proposals":[]}';
      let parsed: any = { proposals: [] };
      try { parsed = JSON.parse(content); } catch { /* ignore */ }
      const existingNames = new Set(categories.map(c => c.name.toLowerCase().trim()));
      const proposals: ProposedCategory[] = (Array.isArray(parsed.proposals) ? parsed.proposals : [])
        .filter((p: any) => p && typeof p.name === 'string' && !existingNames.has(p.name.toLowerCase().trim()))
        .slice(0, 10)
        .map((p: any) => ({
          name: String(p.name).slice(0, 40),
          icon: String(p.icon || '📁').slice(0, 4),
          color: /^#[0-9a-fA-F]{6}$/.test(String(p.color)) ? p.color : '#6C63FF',
          type: p.type === 'income' ? 'income' : 'expense',
          parent_name: typeof p.parent_name === 'string' && p.parent_name.length > 0 ? p.parent_name : null,
          rationale: typeof p.rationale === 'string' ? p.rationale.slice(0, 120) : undefined,
        }));

      const payload = { proposals };
      admin.from('ai_cache').upsert({
        cache_key: cacheKey,
        feature: 'ai_categories_suggest',
        response: payload,
        expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      }, { onConflict: 'cache_key' }).then(() => {}, () => {});

      return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ---- Coach mode (existing) ----
    if (categories.length === 0) {
      return new Response(JSON.stringify({ suggestions: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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

    const payload = { suggestions };
    admin.from('ai_cache').upsert({
      cache_key: cacheKey,
      feature: 'ai_categories_suggest',
      response: payload,
      expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    }, { onConflict: 'cache_key' }).then(() => {}, () => {});

    return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('ai-categories-suggest error:', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
