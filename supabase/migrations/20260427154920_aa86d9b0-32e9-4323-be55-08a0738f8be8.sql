-- Add country / geolocation tracking to profiles for fraud prevention and phone validation
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS signup_country text,
  ADD COLUMN IF NOT EXISTS signup_ip inet;

-- Security signals (VPN/proxy/Tor detection, country mismatch)
CREATE TABLE IF NOT EXISTS public.security_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  event_type text NOT NULL, -- 'vpn_detected', 'proxy_detected', 'tor_detected', 'country_mismatch', 'high_risk_signup'
  ip_address inet,
  detected_country text,
  declared_country text,
  risk_score integer NOT NULL DEFAULT 0,
  is_vpn boolean NOT NULL DEFAULT false,
  is_proxy boolean NOT NULL DEFAULT false,
  is_tor boolean NOT NULL DEFAULT false,
  is_hosting boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.security_signals ENABLE ROW LEVEL SECURITY;

-- Only admins can read; clients cannot write (edge functions use service role)
CREATE POLICY "Admins read security signals"
  ON public.security_signals FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR auth.uid() = user_id);

CREATE POLICY "Deny client writes on security_signals"
  ON public.security_signals FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_security_signals_user ON public.security_signals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_signals_event ON public.security_signals(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_signals_ip ON public.security_signals(ip_address, created_at DESC);