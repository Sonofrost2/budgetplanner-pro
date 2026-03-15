
-- Function to get family member profiles (bypasses RLS on profiles)
CREATE OR REPLACE FUNCTION public.get_family_member_profiles(p_group_id uuid)
RETURNS TABLE(user_id uuid, display_name text, avatar_url text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verify caller is a member of the group
  IF NOT public.is_family_member(auth.uid(), p_group_id) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  RETURN QUERY
    SELECT p.user_id, p.display_name, p.avatar_url
    FROM public.profiles p
    INNER JOIN public.family_members fm ON fm.user_id = p.user_id
    WHERE fm.group_id = p_group_id;
END;
$$;

-- Function to get family member transactions (bypasses RLS on transactions)
CREATE OR REPLACE FUNCTION public.get_family_transactions(p_group_id uuid, p_limit integer DEFAULT 50)
RETURNS TABLE(
  id uuid, user_id uuid, amount numeric, type text, date date,
  description text, category_name text, category_icon text,
  display_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_family_member(auth.uid(), p_group_id) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  RETURN QUERY
    SELECT t.id, t.user_id, t.amount, t.type, t.date,
           t.description, c.name AS category_name, c.icon AS category_icon,
           p.display_name
    FROM public.transactions t
    INNER JOIN public.family_members fm ON fm.user_id = t.user_id AND fm.group_id = p_group_id
    LEFT JOIN public.categories c ON c.id = t.category_id
    LEFT JOIN public.profiles p ON p.user_id = t.user_id
    ORDER BY t.date DESC
    LIMIT p_limit;
END;
$$;

-- Function to calculate budget spending server-side
CREATE OR REPLACE FUNCTION public.get_budget_spending(p_user_id uuid, p_category_id uuid, p_type text, p_start_date date, p_end_date date)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM public.transactions
  WHERE user_id = p_user_id
    AND category_id = p_category_id
    AND type = p_type
    AND date >= p_start_date
    AND date <= p_end_date;
$$;
