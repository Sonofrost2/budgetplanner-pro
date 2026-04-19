import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requirePlan } from "../_shared/requirePlan.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const gate = await requirePlan(req, ["premium"], { feature: "ai_detect_recurring", auditSubtype: "ai-detect-recurring" });
    if (!gate.ok) return gate.response!;
    const userId = gate.userId!;
    // Use authenticated client for tx fetch (RLS still applies)
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Fetch last 6 months of transactions
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const startDate = sixMonthsAgo.toISOString().split('T')[0];

    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('description, amount, type, date, category_id, account_id, categories(name, icon, color)')
      .eq('user_id', userId)
      .gte('date', startDate)
      .order('date', { ascending: true });

    if (txError) throw txError;
    if (!transactions || transactions.length === 0) {
      return new Response(JSON.stringify({ patterns: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch existing recurring to avoid duplicates
    const { data: existingRecurring } = await supabase
      .from('recurring_transactions')
      .select('description, amount, frequency')
      .eq('user_id', userId);

    // Prepare anonymized data for AI
    const txSummary = transactions.map(tx => ({
      desc: tx.description,
      amt: Number(tx.amount),
      type: tx.type,
      date: tx.date,
      cat: (tx.categories as any)?.name || null,
      cat_icon: (tx.categories as any)?.icon || null,
    }));

    const existingList = (existingRecurring || []).map(r => `${r.description} (${r.amount}, ${r.frequency})`).join('; ');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const systemPrompt = `Tu es un analyste financier expert. Analyse les transactions et détecte les patterns récurrents.

RÈGLES:
- Cherche les transactions avec des montants similaires (±10%) qui apparaissent régulièrement
- Détecte la fréquence: daily (quotidien), weekly (hebdo), monthly (mensuel), quarterly (trimestriel), semi_annual (semestriel), yearly (annuel)
- Regroupe les transactions avec des descriptions similaires même si les montants varient légèrement
- Calcule le montant moyen pour chaque pattern
- Indique la confiance (0-100) basée sur la régularité
- Ignore les patterns déjà existants: ${existingList || 'aucun'}
- Un pattern doit avoir au minimum 2 occurrences pour être considéré
- Inclus aussi bien les revenus que les dépenses`;

    const userPrompt = `Voici les transactions des 6 derniers mois (${transactions.length} transactions):
${JSON.stringify(txSummary)}

Détecte les patterns récurrents.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'report_recurring_patterns',
            description: 'Report detected recurring transaction patterns',
            parameters: {
              type: 'object',
              properties: {
                patterns: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      description: { type: 'string', description: 'Clear name for this recurring transaction' },
                      average_amount: { type: 'number', description: 'Average amount across occurrences' },
                      type: { type: 'string', enum: ['income', 'expense'] },
                      frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'quarterly', 'semi_annual', 'yearly'] },
                      category_name: { type: 'string', description: 'Most common category name, or null' },
                      category_icon: { type: 'string', description: 'Category icon emoji' },
                      occurrences: { type: 'number', description: 'Number of times this pattern was observed' },
                      confidence: { type: 'number', description: 'Confidence score 0-100' },
                      last_date: { type: 'string', description: 'Date of last occurrence (YYYY-MM-DD)' },
                      account_description: { type: 'string', description: 'Brief note about usual payment method' },
                    },
                    required: ['description', 'average_amount', 'type', 'frequency', 'occurrences', 'confidence', 'last_date'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['patterns'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'report_recurring_patterns' } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errText = await response.text();
      console.error('AI error:', response.status, errText);
      throw new Error('AI gateway error');
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    let patterns: any[] = [];

    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        patterns = (parsed.patterns || [])
          .filter((p: any) => p.confidence >= 40)
          .sort((a: any, b: any) => b.confidence - a.confidence);
      } catch (e) {
        console.error('Failed to parse AI response:', e);
      }
    }

    // Enrich patterns with category_id and account_id from actual transactions
    for (const pattern of patterns) {
      // Find matching transactions to get category_id and account_id
      const matching = transactions.filter(tx =>
        tx.description.toLowerCase().includes(pattern.description.toLowerCase().split(' ')[0]) ||
        pattern.description.toLowerCase().includes(tx.description.toLowerCase().split(' ')[0])
      );
      if (matching.length > 0) {
        const last = matching[matching.length - 1];
        pattern.category_id = last.category_id;
        pattern.account_id = last.account_id;
      }
    }

    return new Response(JSON.stringify({ patterns }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('ai-detect-recurring error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
