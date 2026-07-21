-- ============================================================
-- Catégories: hiérarchie jusqu'à 5 niveaux + protection cycles
-- ============================================================

-- Fonction utilitaire : profondeur d'une catégorie (1 = racine)
CREATE OR REPLACE FUNCTION public._category_depth(p_id uuid)
RETURNS int
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_depth int := 0;
  v_current uuid := p_id;
  v_parent uuid;
BEGIN
  WHILE v_current IS NOT NULL AND v_depth < 20 LOOP
    v_depth := v_depth + 1;
    SELECT parent_category_id INTO v_parent FROM public.categories WHERE id = v_current;
    v_current := v_parent;
  END LOOP;
  RETURN v_depth;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._category_depth(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public._category_depth(uuid) TO authenticated, service_role;

-- Fonction utilitaire : hauteur du sous-arbre (nb de niveaux sous cette catégorie, 0 si feuille)
CREATE OR REPLACE FUNCTION public._category_subtree_height(p_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE sub(id, depth) AS (
    SELECT p_id, 0
    UNION ALL
    SELECT c.id, s.depth + 1
    FROM public.categories c
    JOIN sub s ON c.parent_category_id = s.id
    WHERE s.depth < 20
  )
  SELECT COALESCE(MAX(depth), 0) FROM sub;
$$;

REVOKE EXECUTE ON FUNCTION public._category_subtree_height(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public._category_subtree_height(uuid) TO authenticated, service_role;

-- Trigger: valide profondeur ≤ 5 et absence de cycle à chaque insert/update
CREATE OR REPLACE FUNCTION public.enforce_category_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_depth int;
  v_subtree_height int;
  v_current uuid;
  v_hops int := 0;
BEGIN
  IF NEW.parent_category_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_category_id = NEW.id THEN
    RAISE EXCEPTION 'Category cannot be its own parent';
  END IF;

  -- Cycle detection: remonter la chaîne du parent, si on retombe sur NEW.id → cycle
  IF TG_OP = 'UPDATE' THEN
    v_current := NEW.parent_category_id;
    WHILE v_current IS NOT NULL AND v_hops < 20 LOOP
      IF v_current = NEW.id THEN
        RAISE EXCEPTION 'Category hierarchy cycle detected';
      END IF;
      SELECT parent_category_id INTO v_current FROM public.categories WHERE id = v_current;
      v_hops := v_hops + 1;
    END LOOP;
  END IF;

  -- Profondeur du parent
  v_parent_depth := public._category_depth(NEW.parent_category_id);

  -- Hauteur du sous-arbre déplacé (0 pour un nouvel enregistrement)
  IF TG_OP = 'UPDATE' THEN
    v_subtree_height := public._category_subtree_height(NEW.id);
  ELSE
    v_subtree_height := 0;
  END IF;

  -- Profondeur finale = parent_depth + 1 (NEW) + hauteur du sous-arbre
  IF (v_parent_depth + 1 + v_subtree_height) > 5 THEN
    RAISE EXCEPTION 'Category hierarchy exceeds max depth of 5 (final depth would be %)', (v_parent_depth + 1 + v_subtree_height);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_category_hierarchy ON public.categories;
CREATE TRIGGER trg_enforce_category_hierarchy
  BEFORE INSERT OR UPDATE OF parent_category_id ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_category_hierarchy();

-- ============================================================
-- Refonte bulk_reparent_categories : autorise parent à toute profondeur ≤ 4
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
  v_parent_depth int;
  v_parent_type text;
  v_child_types text[];
  v_max_subtree int;
BEGIN
  IF auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_new_parent_id IS NOT NULL AND p_new_parent_id = ANY(p_category_ids) THEN
    RAISE EXCEPTION 'A category cannot be its own parent';
  END IF;

  -- Toutes les catégories déplacées doivent appartenir à l'utilisateur
  SELECT COUNT(*) INTO v_invalid
  FROM public.categories
  WHERE id = ANY(p_category_ids) AND user_id <> p_user_id;
  IF v_invalid > 0 THEN
    RAISE EXCEPTION 'Some categories do not belong to user';
  END IF;

  IF p_new_parent_id IS NOT NULL THEN
    -- Parent doit appartenir à l'utilisateur
    SELECT user_id, type INTO v_parent_type, v_parent_type
    FROM public.categories WHERE id = p_new_parent_id;

    SELECT type INTO v_parent_type FROM public.categories
    WHERE id = p_new_parent_id AND user_id = p_user_id;
    IF v_parent_type IS NULL THEN
      RAISE EXCEPTION 'Invalid parent category (unknown or not owned by user)';
    END IF;

    -- Types compatibles : toutes les catégories déplacées doivent avoir le même type que le parent
    SELECT array_agg(DISTINCT type) INTO v_child_types
    FROM public.categories WHERE id = ANY(p_category_ids);
    IF array_length(v_child_types, 1) > 1 OR v_child_types[1] <> v_parent_type THEN
      RAISE EXCEPTION 'Category types must match the parent';
    END IF;

    -- Cycle: aucune des catégories déplacées ne doit être un ancêtre du nouveau parent
    IF EXISTS (
      WITH RECURSIVE anc(id) AS (
        SELECT p_new_parent_id
        UNION ALL
        SELECT c.parent_category_id FROM public.categories c
        JOIN anc ON c.id = anc.id
        WHERE c.parent_category_id IS NOT NULL
      )
      SELECT 1 FROM anc WHERE id = ANY(p_category_ids)
    ) THEN
      RAISE EXCEPTION 'Cannot move a category under its own descendant';
    END IF;

    -- Profondeur max autorisée : parent_depth + 1 + max(subtree) ≤ 5
    v_parent_depth := public._category_depth(p_new_parent_id);
    SELECT COALESCE(MAX(public._category_subtree_height(id)), 0)
    INTO v_max_subtree
    FROM public.categories WHERE id = ANY(p_category_ids);

    IF (v_parent_depth + 1 + v_max_subtree) > 5 THEN
      RAISE EXCEPTION 'Move would exceed max depth of 5 (final depth would be %)', (v_parent_depth + 1 + v_max_subtree);
    END IF;
  END IF;

  UPDATE public.categories
  SET parent_category_id = p_new_parent_id
  WHERE user_id = p_user_id AND id = ANY(p_category_ids);
  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object('updated', v_updated);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bulk_reparent_categories(uuid, uuid[], uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.bulk_reparent_categories(uuid, uuid[], uuid) TO authenticated, service_role;