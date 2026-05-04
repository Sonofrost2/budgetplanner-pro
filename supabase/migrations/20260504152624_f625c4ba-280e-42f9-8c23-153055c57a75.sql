
-- AI response cache for repetitive prompts (categorization, etc.)
CREATE TABLE IF NOT EXISTS public.ai_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key text NOT NULL UNIQUE,
  feature text NOT NULL,
  response jsonb NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_expires ON public.ai_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_cache_feature ON public.ai_cache(feature);

ALTER TABLE public.ai_cache ENABLE ROW LEVEL SECURITY;

-- Only edge functions (service role) read/write the cache.
CREATE POLICY "Deny client access on ai_cache"
  ON public.ai_cache FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Cleanup expired cache entries daily at 04:00.
CREATE OR REPLACE FUNCTION public.cleanup_expired_ai_cache()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.ai_cache WHERE expires_at < now();
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-ai-cache-daily') THEN
    PERFORM cron.schedule(
      'cleanup-ai-cache-daily',
      '0 4 * * *',
      $cron$ SELECT public.cleanup_expired_ai_cache(); $cron$
    );
  END IF;
END $$;
