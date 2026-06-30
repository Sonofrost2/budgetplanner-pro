
-- Add referral columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code TEXT,
  ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Code generator: 8 chars, base32 (no ambiguous chars)
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT;
  i INT;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = code);
  END LOOP;
  RETURN code;
END $$;

-- Trigger to ensure referral_code is set on insert
CREATE OR REPLACE FUNCTION public.set_referral_code()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.referral_code IS NULL OR length(NEW.referral_code) = 0 THEN
    NEW.referral_code := public.generate_referral_code();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_profiles_set_referral_code ON public.profiles;
CREATE TRIGGER trg_profiles_set_referral_code
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_referral_code();

-- Backfill existing rows
UPDATE public.profiles
SET referral_code = public.generate_referral_code()
WHERE referral_code IS NULL;

-- Enforce uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_unique
  ON public.profiles (referral_code);
