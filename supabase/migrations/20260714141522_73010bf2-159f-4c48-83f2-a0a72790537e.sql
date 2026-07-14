
CREATE TABLE public.security_check_ratelimit (
  ip text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.security_check_ratelimit TO service_role;

ALTER TABLE public.security_check_ratelimit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only" ON public.security_check_ratelimit
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_security_check_ratelimit_window ON public.security_check_ratelimit(window_start);

CREATE OR REPLACE FUNCTION public.check_security_ratelimit(_ip text, _max int DEFAULT 10, _window_minutes int DEFAULT 10)
RETURNS TABLE(allowed boolean, current_count int, retry_after_seconds int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  win_start timestamptz;
BEGIN
  win_start := now() - make_interval(mins => _window_minutes);

  INSERT INTO public.security_check_ratelimit(ip, window_start, count, updated_at)
  VALUES (_ip, now(), 1, now())
  ON CONFLICT (ip) DO UPDATE
    SET count = CASE
                  WHEN public.security_check_ratelimit.window_start < win_start THEN 1
                  ELSE public.security_check_ratelimit.count + 1
                END,
        window_start = CASE
                         WHEN public.security_check_ratelimit.window_start < win_start THEN now()
                         ELSE public.security_check_ratelimit.window_start
                       END,
        updated_at = now()
  RETURNING * INTO rec;

  IF rec.count > _max THEN
    RETURN QUERY SELECT false, rec.count, GREATEST(1, _window_minutes*60 - EXTRACT(EPOCH FROM (now() - rec.window_start))::int);
  ELSE
    RETURN QUERY SELECT true, rec.count, 0;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_security_ratelimit(text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_security_ratelimit(text, int, int) TO service_role;
