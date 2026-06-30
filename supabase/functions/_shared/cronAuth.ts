/**
 * Gate for cron-triggered edge functions.
 * Accepts either:
 *  - `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` (internal invocations)
 *  - `x-cron-secret: <CRON_SECRET>` (cron.job headers)
 * Returns null when authorized, or a Response(401) otherwise.
 */
export function requireCronAuth(req: Request, corsHeaders: Record<string, string>): Response | null {
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const cronSecret = Deno.env.get('CRON_SECRET');
  const auth = req.headers.get('Authorization') || '';
  const cronHeader = req.headers.get('x-cron-secret') || '';
  if (service && auth === `Bearer ${service}`) return null;
  if (cronSecret && cronHeader === cronSecret) return null;
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}