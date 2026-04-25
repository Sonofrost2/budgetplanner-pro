-- Admin-managed SMS template overrides
CREATE TABLE public.sms_template_overrides (
  template_id text PRIMARY KEY,
  body_fr text NOT NULL,
  body_en text NOT NULL,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_template_overrides ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read (so the runtime can resolve overrides)
CREATE POLICY "Authenticated can read sms templates"
ON public.sms_template_overrides FOR SELECT TO authenticated
USING (true);

-- Only admins can write
CREATE POLICY "Admins can insert sms templates"
ON public.sms_template_overrides FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update sms templates"
ON public.sms_template_overrides FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete sms templates"
ON public.sms_template_overrides FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_sms_template_overrides_updated_at
BEFORE UPDATE ON public.sms_template_overrides
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();