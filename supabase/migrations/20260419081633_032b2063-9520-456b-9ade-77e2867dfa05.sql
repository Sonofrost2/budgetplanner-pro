-- 1. Colonnes token + expires_at sur family_invitations
ALTER TABLE public.family_invitations
  ADD COLUMN IF NOT EXISTS token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days');

CREATE UNIQUE INDEX IF NOT EXISTS family_invitations_token_uq ON public.family_invitations(token);

-- Anti-doublon : une seule invitation pending par (group, email)
CREATE UNIQUE INDEX IF NOT EXISTS family_invitations_unique_pending
  ON public.family_invitations(group_id, lower(invited_email))
  WHERE status = 'pending';

-- 2. Permettre lecture publique d'une invitation via token (page d'acceptation publique)
DROP POLICY IF EXISTS "Public can view invitation by token" ON public.family_invitations;
CREATE POLICY "Public can view invitation by token"
  ON public.family_invitations
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 3. Activer UPDATE sur family_members (changement de rôle par owner, ou self pour leave)
DROP POLICY IF EXISTS "Owners can update member roles" ON public.family_members;
CREATE POLICY "Owners can update member roles"
  ON public.family_members
  FOR UPDATE
  TO authenticated
  USING (public.is_family_owner(auth.uid(), group_id))
  WITH CHECK (public.is_family_owner(auth.uid(), group_id));

-- Permettre à un membre de se retirer
DROP POLICY IF EXISTS "Members can leave group" ON public.family_members;
CREATE POLICY "Members can leave group"
  ON public.family_members
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND NOT public.is_family_owner(auth.uid(), group_id));

-- 4. Helper is_family_admin
CREATE OR REPLACE FUNCTION public.is_family_admin(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE user_id = _user_id AND group_id = _group_id AND role IN ('owner','admin')
  );
$$;

-- 5. RPC accept_family_invitation
CREATE OR REPLACE FUNCTION public.accept_family_invitation(p_token uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inv record;
  v_user_email text;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

  SELECT * INTO v_inv FROM public.family_invitations WHERE token = p_token;
  IF v_inv IS NULL THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;
  IF v_inv.status <> 'pending' THEN
    RAISE EXCEPTION 'Invitation already %', v_inv.status;
  END IF;
  IF v_inv.expires_at < now() THEN
    UPDATE public.family_invitations SET status = 'expired' WHERE id = v_inv.id;
    RAISE EXCEPTION 'Invitation expired';
  END IF;
  IF lower(v_inv.invited_email) <> lower(v_user_email) THEN
    RAISE EXCEPTION 'Email mismatch — please log in with %', v_inv.invited_email;
  END IF;

  -- Insert member if not exists
  INSERT INTO public.family_members (group_id, user_id, role)
  VALUES (v_inv.group_id, v_user_id, 'member')
  ON CONFLICT DO NOTHING;

  UPDATE public.family_invitations SET status = 'accepted' WHERE id = v_inv.id;

  RETURN jsonb_build_object('group_id', v_inv.group_id, 'accepted', true);
END;
$$;

-- 6. RPC leave_family_group
CREATE OR REPLACE FUNCTION public.leave_family_group(p_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF public.is_family_owner(v_user_id, p_group_id) THEN
    RAISE EXCEPTION 'Owner must transfer ownership before leaving';
  END IF;
  DELETE FROM public.family_members WHERE group_id = p_group_id AND user_id = v_user_id;
  RETURN jsonb_build_object('left', true);
END;
$$;

-- 7. RPC transfer_family_ownership
CREATE OR REPLACE FUNCTION public.transfer_family_ownership(p_group_id uuid, p_new_owner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.is_family_owner(v_user_id, p_group_id) THEN
    RAISE EXCEPTION 'Only the owner can transfer ownership';
  END IF;
  IF NOT public.is_family_member(p_new_owner_id, p_group_id) THEN
    RAISE EXCEPTION 'New owner must be a member';
  END IF;

  UPDATE public.family_groups SET owner_id = p_new_owner_id, updated_at = now() WHERE id = p_group_id;
  UPDATE public.family_members SET role = 'member' WHERE group_id = p_group_id AND user_id = v_user_id;
  UPDATE public.family_members SET role = 'owner' WHERE group_id = p_group_id AND user_id = p_new_owner_id;

  RETURN jsonb_build_object('transferred', true);
END;
$$;

-- 8. RPC delete_family_group_cascade
CREATE OR REPLACE FUNCTION public.delete_family_group_cascade(p_group_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF NOT public.is_family_owner(v_user_id, p_group_id) THEN
    RAISE EXCEPTION 'Only the owner can delete the group';
  END IF;
  DELETE FROM public.shared_budgets WHERE group_id = p_group_id;
  DELETE FROM public.family_invitations WHERE group_id = p_group_id;
  DELETE FROM public.family_members WHERE group_id = p_group_id;
  DELETE FROM public.family_groups WHERE id = p_group_id;
  RETURN jsonb_build_object('deleted', true);
END;
$$;

-- 9. RPC get_family_dashboard
CREATE OR REPLACE FUNCTION public.get_family_dashboard(p_group_id uuid, p_start_date date, p_end_date date)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_member_stats jsonb;
  v_categories jsonb;
  v_shared_budgets jsonb;
  v_total_income numeric;
  v_total_expense numeric;
BEGIN
  IF NOT public.is_family_member(auth.uid(), p_group_id) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  -- Per-member totals
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', s.user_id,
    'display_name', s.display_name,
    'income', s.income,
    'expense', s.expense,
    'tx_count', s.tx_count
  ) ORDER BY s.expense DESC), '[]'::jsonb) INTO v_member_stats
  FROM (
    SELECT 
      fm.user_id,
      COALESCE(p.display_name, 'Membre') AS display_name,
      COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount END), 0) AS income,
      COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount END), 0) AS expense,
      COUNT(t.id) AS tx_count
    FROM public.family_members fm
    LEFT JOIN public.profiles p ON p.user_id = fm.user_id
    LEFT JOIN public.transactions t ON t.user_id = fm.user_id 
      AND t.deleted_at IS NULL 
      AND t.date BETWEEN p_start_date AND p_end_date
    WHERE fm.group_id = p_group_id
    GROUP BY fm.user_id, p.display_name
  ) s;

  -- Top categories (expense)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'category_id', sub.category_id,
    'name', sub.name,
    'icon', sub.icon,
    'color', sub.color,
    'total', sub.total
  ) ORDER BY sub.total DESC), '[]'::jsonb) INTO v_categories
  FROM (
    SELECT t.category_id, c.name, c.icon, c.color, SUM(t.amount) AS total
    FROM public.transactions t
    INNER JOIN public.family_members fm ON fm.user_id = t.user_id AND fm.group_id = p_group_id
    LEFT JOIN public.categories c ON c.id = t.category_id
    WHERE t.type = 'expense' AND t.deleted_at IS NULL
      AND t.date BETWEEN p_start_date AND p_end_date
    GROUP BY t.category_id, c.name, c.icon, c.color
    ORDER BY total DESC LIMIT 5
  ) sub;

  -- Shared budgets progression
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'budget_id', b.id,
    'name', b.name,
    'amount', b.amount,
    'spent', COALESCE(spent.total, 0),
    'pct', CASE WHEN b.amount > 0 THEN ROUND((COALESCE(spent.total, 0) / b.amount) * 100, 1) ELSE 0 END
  ) ORDER BY b.name), '[]'::jsonb) INTO v_shared_budgets
  FROM public.shared_budgets sb
  INNER JOIN public.budgets b ON b.id = sb.budget_id AND b.deleted_at IS NULL
  LEFT JOIN LATERAL (
    SELECT SUM(t.amount) AS total
    FROM public.transactions t
    INNER JOIN public.family_members fm ON fm.user_id = t.user_id AND fm.group_id = p_group_id
    WHERE t.category_id = b.category_id 
      AND t.type = b.budget_type
      AND t.deleted_at IS NULL
      AND t.date BETWEEN p_start_date AND p_end_date
  ) spent ON TRUE
  WHERE sb.group_id = p_group_id;

  -- Totals
  SELECT 
    COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount END), 0),
    COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount END), 0)
  INTO v_total_income, v_total_expense
  FROM public.transactions t
  INNER JOIN public.family_members fm ON fm.user_id = t.user_id AND fm.group_id = p_group_id
  WHERE t.deleted_at IS NULL AND t.date BETWEEN p_start_date AND p_end_date;

  RETURN jsonb_build_object(
    'total_income', v_total_income,
    'total_expense', v_total_expense,
    'net', v_total_income - v_total_expense,
    'members', v_member_stats,
    'top_categories', v_categories,
    'shared_budgets', v_shared_budgets
  );
END;
$$;