-- ============================================
-- 1. SCHEMA CHANGES
-- ============================================

-- Mark a category as the user's "Famille" root
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_family_root boolean NOT NULL DEFAULT false;

-- Only one family root per user
CREATE UNIQUE INDEX IF NOT EXISTS categories_one_family_root_per_user
  ON public.categories (user_id) WHERE is_family_root = true AND deleted_at IS NULL;

-- New table: shared sub-categories per family group
CREATE TABLE IF NOT EXISTS public.family_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.family_groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text NOT NULL DEFAULT '👨‍👩‍👧',
  color text NOT NULL DEFAULT '#8B5CF6',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, name)
);

CREATE INDEX IF NOT EXISTS idx_family_categories_group ON public.family_categories(group_id);

ALTER TABLE public.family_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view family categories" ON public.family_categories;
CREATE POLICY "Members can view family categories"
  ON public.family_categories FOR SELECT TO authenticated
  USING (public.is_family_member(auth.uid(), group_id));

DROP POLICY IF EXISTS "Members can create family categories" ON public.family_categories;
CREATE POLICY "Members can create family categories"
  ON public.family_categories FOR INSERT TO authenticated
  WITH CHECK (public.is_family_member(auth.uid(), group_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Creator or owner can update family categories" ON public.family_categories;
CREATE POLICY "Creator or owner can update family categories"
  ON public.family_categories FOR UPDATE TO authenticated
  USING (public.is_family_member(auth.uid(), group_id) AND (created_by = auth.uid() OR public.is_family_owner(auth.uid(), group_id)))
  WITH CHECK (public.is_family_member(auth.uid(), group_id));

DROP POLICY IF EXISTS "Creator or owner can delete family categories" ON public.family_categories;
CREATE POLICY "Creator or owner can delete family categories"
  ON public.family_categories FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_family_owner(auth.uid(), group_id));

CREATE TRIGGER trg_family_categories_updated_at
  BEFORE UPDATE ON public.family_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Link transactions to a shared family sub-category (optional)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS family_category_id uuid REFERENCES public.family_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_family_category
  ON public.transactions(family_category_id) WHERE family_category_id IS NOT NULL;

-- ============================================
-- 2. SEEDING FUNCTIONS
-- ============================================

-- Seed default sub-categories for a family group (idempotent)
CREATE OR REPLACE FUNCTION public.seed_default_family_group_categories(p_group_id uuid, p_creator uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.family_categories (group_id, name, icon, color, created_by) VALUES
    (p_group_id, 'Courses ménage', '🛒', '#22C55E', p_creator),
    (p_group_id, 'Logement famille', '🏠', '#8B5CF6', p_creator),
    (p_group_id, 'Enfants', '👶', '#F59E0B', p_creator),
    (p_group_id, 'Santé famille', '💊', '#EF4444', p_creator),
    (p_group_id, 'Loisirs famille', '🎉', '#3B82F6', p_creator),
    (p_group_id, 'Autre famille', '📁', '#6B7280', p_creator)
  ON CONFLICT (group_id, name) DO NOTHING;
END;
$$;

-- Ensure a user has a "Famille" root category + 6 default sub-categories
CREATE OR REPLACE FUNCTION public.ensure_user_family_root(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_root_id uuid;
BEGIN
  SELECT id INTO v_root_id
  FROM public.categories
  WHERE user_id = p_user_id AND is_family_root = true AND deleted_at IS NULL
  LIMIT 1;

  IF v_root_id IS NULL THEN
    INSERT INTO public.categories (user_id, name, icon, color, type, is_family_root)
    VALUES (p_user_id, 'Famille', '👨‍👩‍👧', '#8B5CF6', 'expense', true)
    RETURNING id INTO v_root_id;

    INSERT INTO public.categories (user_id, name, icon, color, type, parent_category_id) VALUES
      (p_user_id, 'Courses ménage', '🛒', '#22C55E', 'expense', v_root_id),
      (p_user_id, 'Logement famille', '🏠', '#8B5CF6', 'expense', v_root_id),
      (p_user_id, 'Enfants', '👶', '#F59E0B', 'expense', v_root_id),
      (p_user_id, 'Santé famille', '💊', '#EF4444', 'expense', v_root_id),
      (p_user_id, 'Loisirs famille', '🎉', '#3B82F6', 'expense', v_root_id),
      (p_user_id, 'Autre famille', '📁', '#6B7280', 'expense', v_root_id);
  END IF;

  RETURN v_root_id;
END;
$$;

-- ============================================
-- 3. TRIGGERS — auto-seed on join / on group create
-- ============================================

CREATE OR REPLACE FUNCTION public.on_family_member_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Ensure the new member has a "Famille" root in their personal categories
  PERFORM public.ensure_user_family_root(NEW.user_id);

  -- 2. Ensure the group has default shared sub-categories
  IF NOT EXISTS (SELECT 1 FROM public.family_categories WHERE group_id = NEW.group_id LIMIT 1) THEN
    PERFORM public.seed_default_family_group_categories(NEW.group_id, NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_family_member_added ON public.family_members;
CREATE TRIGGER trg_on_family_member_added
  AFTER INSERT ON public.family_members
  FOR EACH ROW EXECUTE FUNCTION public.on_family_member_added();

-- ============================================
-- 4. RETROACTIVE SEEDING for existing members
-- ============================================

DO $$
DECLARE
  v_member record;
BEGIN
  FOR v_member IN SELECT user_id, group_id FROM public.family_members LOOP
    PERFORM public.ensure_user_family_root(v_member.user_id);
    IF NOT EXISTS (SELECT 1 FROM public.family_categories WHERE group_id = v_member.group_id LIMIT 1) THEN
      PERFORM public.seed_default_family_group_categories(v_member.group_id, v_member.user_id);
    END IF;
  END LOOP;
END $$;

-- ============================================
-- 5. UPDATE FAMILY DASHBOARD / TX RPCs to filter by family_category_id
-- ============================================

CREATE OR REPLACE FUNCTION public.get_family_dashboard(p_group_id uuid, p_start_date date, p_end_date date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
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

  -- Per-member totals — ONLY family-tagged transactions
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', s.user_id, 'display_name', s.display_name,
    'income', s.income, 'expense', s.expense, 'tx_count', s.tx_count
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
      AND t.family_category_id IN (SELECT id FROM public.family_categories WHERE group_id = p_group_id)
    WHERE fm.group_id = p_group_id
    GROUP BY fm.user_id, p.display_name
  ) s;

  -- Top family sub-categories
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'category_id', sub.fc_id, 'name', sub.name, 'icon', sub.icon, 'color', sub.color, 'total', sub.total
  ) ORDER BY sub.total DESC), '[]'::jsonb) INTO v_categories
  FROM (
    SELECT fc.id AS fc_id, fc.name, fc.icon, fc.color, SUM(t.amount) AS total
    FROM public.transactions t
    INNER JOIN public.family_categories fc ON fc.id = t.family_category_id AND fc.group_id = p_group_id
    INNER JOIN public.family_members fm ON fm.user_id = t.user_id AND fm.group_id = p_group_id
    WHERE t.type = 'expense' AND t.deleted_at IS NULL
      AND t.date BETWEEN p_start_date AND p_end_date
    GROUP BY fc.id, fc.name, fc.icon, fc.color
    ORDER BY total DESC LIMIT 5
  ) sub;

  -- Shared budgets — only those tied to a family root descendant
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'budget_id', b.id, 'name', b.name, 'amount', b.amount,
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

  -- Totals — ONLY family-tagged
  SELECT 
    COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount END), 0),
    COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount END), 0)
  INTO v_total_income, v_total_expense
  FROM public.transactions t
  INNER JOIN public.family_members fm ON fm.user_id = t.user_id AND fm.group_id = p_group_id
  WHERE t.deleted_at IS NULL 
    AND t.date BETWEEN p_start_date AND p_end_date
    AND t.family_category_id IN (SELECT id FROM public.family_categories WHERE group_id = p_group_id);

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

CREATE OR REPLACE FUNCTION public.get_family_transactions(p_group_id uuid, p_limit integer DEFAULT 50)
RETURNS TABLE(id uuid, user_id uuid, amount numeric, type text, date date, description text, category_name text, category_icon text, display_name text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_family_member(auth.uid(), p_group_id) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  RETURN QUERY
    SELECT t.id, t.user_id, t.amount, t.type, t.date,
           t.description, fc.name AS category_name, fc.icon AS category_icon,
           p.display_name
    FROM public.transactions t
    INNER JOIN public.family_categories fc ON fc.id = t.family_category_id AND fc.group_id = p_group_id
    INNER JOIN public.family_members fm ON fm.user_id = t.user_id AND fm.group_id = p_group_id
    LEFT JOIN public.profiles p ON p.user_id = t.user_id
    WHERE t.deleted_at IS NULL
    ORDER BY t.date DESC
    LIMIT p_limit;
END;
$$;

-- ============================================
-- 6. UPDATE notify_family_on_large_transaction — only family-tagged tx
-- ============================================

CREATE OR REPLACE FUNCTION public.notify_family_on_large_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_name text;
  v_personal_threshold numeric;
  v_member record;
  v_member_prefs record;
  v_group_threshold numeric;
  v_effective_threshold numeric;
  v_current_hour int;
  v_in_quiet boolean;
  v_dedup text;
  v_title text;
  v_body text;
  v_target_group uuid;
  v_supabase_url text := 'https://sfcwoftgzxplbexcmzva.supabase.co';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmY3dvZnRnenhwbGJleGNtenZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MjM5OTYsImV4cCI6MjA4ODQ5OTk5Nn0.PRMjJgY1JDygvq-r5QDAugGZed3eEvS_Ie9wD3B1_qE';
BEGIN
  -- Privacy guard: only notify on transactions explicitly tagged as family
  IF NEW.deleted_at IS NOT NULL OR NEW.linked_transfer_id IS NOT NULL OR NEW.family_category_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT group_id INTO v_target_group FROM public.family_categories WHERE id = NEW.family_category_id;
  IF v_target_group IS NULL THEN RETURN NEW; END IF;

  SELECT large_transaction_threshold INTO v_personal_threshold
  FROM notification_preferences WHERE user_id = NEW.user_id;
  v_personal_threshold := COALESCE(v_personal_threshold, 50000);

  SELECT COALESCE(display_name, 'Un membre') INTO v_actor_name
  FROM profiles WHERE user_id = NEW.user_id;

  v_title := CASE WHEN NEW.type='expense' THEN '👨‍👩‍👧 Dépense famille' ELSE '👨‍👩‍👧 Revenu famille' END;
  v_body := v_actor_name || ' • ' || NEW.description || ' • ' || to_char(NEW.amount, 'FM999G999G999');

  FOR v_member IN
    SELECT fm.user_id, fg.large_tx_threshold AS group_threshold
    FROM family_members fm
    INNER JOIN family_groups fg ON fg.id = fm.group_id
    WHERE fm.group_id = v_target_group AND fm.user_id <> NEW.user_id
  LOOP
    v_group_threshold := COALESCE(v_member.group_threshold, 100000);
    v_effective_threshold := LEAST(v_personal_threshold, v_group_threshold);
    IF NEW.amount < v_effective_threshold THEN CONTINUE; END IF;

    SELECT * INTO v_member_prefs FROM notification_preferences WHERE user_id = v_member.user_id;
    IF v_member_prefs IS NULL OR NOT v_member_prefs.large_transaction THEN CONTINUE; END IF;

    IF v_member_prefs.quiet_hours_enabled THEN
      v_current_hour := EXTRACT(HOUR FROM now() AT TIME ZONE 'UTC');
      IF v_member_prefs.quiet_hours_start > v_member_prefs.quiet_hours_end THEN
        v_in_quiet := v_current_hour >= v_member_prefs.quiet_hours_start OR v_current_hour < v_member_prefs.quiet_hours_end;
      ELSE
        v_in_quiet := v_current_hour >= v_member_prefs.quiet_hours_start AND v_current_hour < v_member_prefs.quiet_hours_end;
      END IF;
      IF v_in_quiet THEN CONTINUE; END IF;
    END IF;

    v_dedup := 'family_tx:' || NEW.id::text || ':' || v_member.user_id::text;

    BEGIN
      INSERT INTO notification_history (user_id, notification_type, channel, title, body, dedup_key, reference_id)
      VALUES (v_member.user_id, 'family_activity', 'push', v_title, v_body, v_dedup, NEW.id::text);
    EXCEPTION WHEN unique_violation THEN
      CONTINUE;
    END;

    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/push-notify',
      headers := jsonb_build_object('Content-Type', 'application/json', 'apikey', v_anon, 'Authorization', 'Bearer ' || v_anon),
      body := jsonb_build_object(
        'user_id', v_member.user_id,
        'title', v_title,
        'body', v_body,
        'data', jsonb_build_object('url', '/dashboard/family')
      ),
      timeout_milliseconds := 30000
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- ============================================
-- 7. CONSTRAINT — shared_budgets must be on a family-root descendant
-- ============================================

CREATE OR REPLACE FUNCTION public.validate_shared_budget()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat_user uuid;
  v_parent uuid;
  v_is_family boolean;
BEGIN
  SELECT b.user_id, c.parent_category_id INTO v_cat_user, v_parent
  FROM public.budgets b
  LEFT JOIN public.categories c ON c.id = b.category_id
  WHERE b.id = NEW.budget_id;

  IF v_parent IS NULL THEN
    RAISE EXCEPTION 'Shared budgets must be tied to a sub-category of the Famille root';
  END IF;

  SELECT is_family_root INTO v_is_family FROM public.categories WHERE id = v_parent;
  IF NOT COALESCE(v_is_family, false) THEN
    RAISE EXCEPTION 'Shared budgets must be tied to a sub-category of the Famille root';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_shared_budget ON public.shared_budgets;
CREATE TRIGGER trg_validate_shared_budget
  BEFORE INSERT ON public.shared_budgets
  FOR EACH ROW EXECUTE FUNCTION public.validate_shared_budget();