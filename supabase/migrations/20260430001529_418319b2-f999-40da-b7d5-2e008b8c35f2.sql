-- Lock down all public schema functions: revoke from PUBLIC, grant only to authenticated
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name,
           p.proname AS func_name,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC',
                   r.schema_name, r.func_name, r.args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon',
                   r.schema_name, r.func_name, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated',
                   r.schema_name, r.func_name, r.args);
  END LOOP;
END $$;

-- Re-grant the public invitation flow to anon
GRANT EXECUTE ON FUNCTION public.accept_family_invitation(uuid) TO anon;