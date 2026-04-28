-- Update existing demo user if present
UPDATE auth.users 
SET email = 'demo@budgetplanner-pro.eurekaci.dev'
WHERE email = 'demo@budgetplanner.app';

UPDATE auth.identities
SET identity_data = jsonb_set(identity_data, '{email}', '"demo@budgetplanner-pro.eurekaci.dev"')
WHERE identity_data->>'email' = 'demo@budgetplanner.app';

-- Update functions to match new email
CREATE OR REPLACE FUNCTION public.get_demo_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT id FROM auth.users WHERE email = 'demo@budgetplanner-pro.eurekaci.dev' LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_demo_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE id = _user_id AND email = 'demo@budgetplanner-pro.eurekaci.dev'
  );
$$;
