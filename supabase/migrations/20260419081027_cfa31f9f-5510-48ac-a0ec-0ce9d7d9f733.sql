-- Index pour requêtes hiérarchiques rapides
CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories(parent_category_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_categories_user_active ON public.categories(user_id, type) WHERE deleted_at IS NULL AND archived_at IS NULL;

-- ============================================================
-- merge_categories: fusion atomique de N catégories vers 1
-- ============================================================
CREATE OR REPLACE FUNCTION public.merge_categories(
  p_user_id uuid,
  p_source_ids uuid[],
  p_target_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_owner uuid;
  v_invalid_count int;
  v_tx_count int := 0;
  v_budget_count int := 0;
  v_rec_count int := 0;
  v_tpl_count int := 0;
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_target_id = ANY(p_source_ids) THEN
    RAISE EXCEPTION 'Target cannot be in source list';
  END IF;

  -- Vérifier ownership cible
  SELECT user_id INTO v_target_owner FROM public.categories WHERE id = p_target_id;
  IF v_target_owner IS NULL OR v_target_owner <> p_user_id THEN
    RAISE EXCEPTION 'Target category not found or unauthorized';
  END IF;

  -- Vérifier ownership de toutes les sources
  SELECT COUNT(*) INTO v_invalid_count
  FROM public.categories
  WHERE id = ANY(p_source_ids) AND user_id <> p_user_id;
  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION 'Some source categories do not belong to user';
  END IF;

  -- Réassigner transactions
  UPDATE public.transactions SET category_id = p_target_id, updated_at = now()
  WHERE user_id = p_user_id AND category_id = ANY(p_source_ids);
  GET DIAGNOSTICS v_tx_count = ROW_COUNT;

  -- Réassigner budgets
  UPDATE public.budgets SET category_id = p_target_id, updated_at = now()
  WHERE user_id = p_user_id AND category_id = ANY(p_source_ids);
  GET DIAGNOSTICS v_budget_count = ROW_COUNT;

  -- Réassigner recurring
  UPDATE public.recurring_transactions SET category_id = p_target_id
  WHERE user_id = p_user_id AND category_id = ANY(p_source_ids);
  GET DIAGNOSTICS v_rec_count = ROW_COUNT;

  -- Réassigner templates
  UPDATE public.transaction_templates SET category_id = p_target_id, updated_at = now()
  WHERE user_id = p_user_id AND category_id = ANY(p_source_ids);
  GET DIAGNOSTICS v_tpl_count = ROW_COUNT;

  -- Soft delete sources
  UPDATE public.categories SET deleted_at = now()
  WHERE user_id = p_user_id AND id = ANY(p_source_ids);

  RETURN jsonb_build_object(
    'merged_count', array_length(p_source_ids, 1),
    'transactions_reassigned', v_tx_count,
    'budgets_reassigned', v_budget_count,
    'recurring_reassigned', v_rec_count,
    'templates_reassigned', v_tpl_count
  );
END;
$$;

-- ============================================================
-- get_category_analytics: stats + sparkline 6 mois pour toutes les catégories
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_category_analytics(p_user_id uuid)
RETURNS TABLE(
  category_id uuid,
  total_amount numeric,
  transaction_count bigint,
  last_used date,
  monthly_series jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT 
      c.id AS cat_id,
      t.amount,
      t.date,
      date_trunc('month', t.date)::date AS month_start
    FROM public.categories c
    LEFT JOIN public.transactions t 
      ON t.category_id = c.id 
      AND t.user_id = p_user_id 
      AND t.deleted_at IS NULL
      AND t.date >= (CURRENT_DATE - interval '6 months')
    WHERE c.user_id = p_user_id AND c.deleted_at IS NULL
  ),
  agg AS (
    SELECT 
      cat_id,
      COALESCE(SUM(amount), 0) AS total_amount,
      COUNT(amount) AS transaction_count,
      MAX(date) AS last_used
    FROM base
    GROUP BY cat_id
  ),
  monthly AS (
    SELECT 
      cat_id,
      jsonb_agg(jsonb_build_object('month', month_start, 'total', m_total) ORDER BY month_start) AS series
    FROM (
      SELECT cat_id, month_start, COALESCE(SUM(amount), 0) AS m_total
      FROM base
      WHERE month_start IS NOT NULL
      GROUP BY cat_id, month_start
    ) m
    GROUP BY cat_id
  )
  SELECT 
    a.cat_id,
    a.total_amount,
    a.transaction_count,
    a.last_used,
    COALESCE(m.series, '[]'::jsonb) AS monthly_series
  FROM agg a
  LEFT JOIN monthly m ON m.cat_id = a.cat_id;
END;
$$;

-- ============================================================
-- bulk_reparent_categories: assigner un parent en masse (ou null pour racine)
-- ============================================================
CREATE OR REPLACE FUNCTION public.bulk_reparent_categories(
  p_user_id uuid,
  p_category_ids uuid[],
  p_new_parent_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invalid int;
  v_updated int;
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_new_parent_id IS NOT NULL AND p_new_parent_id = ANY(p_category_ids) THEN
    RAISE EXCEPTION 'A category cannot be its own parent';
  END IF;

  IF p_new_parent_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_invalid 
    FROM public.categories 
    WHERE id = p_new_parent_id AND (user_id <> p_user_id OR parent_category_id IS NOT NULL);
    IF v_invalid > 0 THEN
      RAISE EXCEPTION 'Invalid parent category (must be root and owned by user)';
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_invalid
  FROM public.categories
  WHERE id = ANY(p_category_ids) AND user_id <> p_user_id;
  IF v_invalid > 0 THEN
    RAISE EXCEPTION 'Some categories do not belong to user';
  END IF;

  UPDATE public.categories 
  SET parent_category_id = p_new_parent_id
  WHERE user_id = p_user_id AND id = ANY(p_category_ids);
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object('updated', v_updated);
END;
$$;