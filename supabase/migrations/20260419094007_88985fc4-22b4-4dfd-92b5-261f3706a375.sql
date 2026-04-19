
CREATE OR REPLACE FUNCTION public.admin_get_user_snapshot(
  _actor_id uuid,
  _target_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public.has_role(_actor_id, 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'admin role required';
  END IF;

  SELECT jsonb_build_object(
    'profile', (
      SELECT to_jsonb(p) FROM (
        SELECT u.id AS user_id, u.email, u.created_at, u.last_sign_in_at,
               u.banned_until, u.email_confirmed_at, u.raw_user_meta_data,
               pr.display_name, pr.avatar_url, pr.locale, pr.currency,
               pr.onboarding_completed
        FROM auth.users u
        LEFT JOIN public.profiles pr ON pr.user_id = u.id
        WHERE u.id = _target_user_id
      ) p
    ),
    'subscription', (
      SELECT to_jsonb(s) FROM (
        SELECT s.status, s.current_period_start, s.current_period_end,
               s.payment_method, s.canceled_at, sp.name AS plan_name
        FROM public.subscriptions s
        LEFT JOIN public.subscription_plans sp ON sp.id = s.plan_id
        WHERE s.user_id = _target_user_id
        ORDER BY s.created_at DESC LIMIT 1
      ) s
    ),
    'effective_plan', COALESCE(public.is_subscription_valid(_target_user_id), 'free'),
    'accounts', (
      SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT id, name, type, icon, opening_balance, real_balance, status,
               last_activity_at, created_at
        FROM public.payment_accounts
        WHERE user_id = _target_user_id AND deleted_at IS NULL
      ) a
    ),
    'totals', (
      SELECT jsonb_build_object(
        'tx_count', (SELECT COUNT(*) FROM public.transactions WHERE user_id = _target_user_id AND deleted_at IS NULL),
        'income_30d', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE user_id = _target_user_id AND deleted_at IS NULL AND type = 'income' AND date >= CURRENT_DATE - 30), 0),
        'expense_30d', COALESCE((SELECT SUM(amount) FROM public.transactions WHERE user_id = _target_user_id AND deleted_at IS NULL AND type = 'expense' AND date >= CURRENT_DATE - 30), 0),
        'net_worth', COALESCE((SELECT SUM(real_balance) FROM public.payment_accounts WHERE user_id = _target_user_id AND deleted_at IS NULL), 0)
            + COALESCE((SELECT SUM(current_value) FROM public.assets WHERE user_id = _target_user_id), 0)
            - COALESCE((SELECT SUM(total_amount - COALESCE(paid_amount,0)) FROM public.debts WHERE user_id = _target_user_id AND deleted_at IS NULL), 0)
      )
    ),
    'recent_transactions', (
      SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.date DESC, t.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT t.id, t.date, t.description, t.amount, t.type, t.notes, t.tags,
               t.created_at, c.name AS category_name, c.icon AS category_icon,
               pa.name AS account_name
        FROM public.transactions t
        LEFT JOIN public.categories c ON c.id = t.category_id
        LEFT JOIN public.payment_accounts pa ON pa.id = t.account_id
        WHERE t.user_id = _target_user_id AND t.deleted_at IS NULL
        ORDER BY t.date DESC, t.created_at DESC
        LIMIT 50
      ) t
    ),
    'budgets', (
      SELECT COALESCE(jsonb_agg(to_jsonb(b)), '[]'::jsonb)
      FROM (
        SELECT id, name, amount, period, budget_type, control_type, paused_at, created_at
        FROM public.budgets WHERE user_id = _target_user_id AND deleted_at IS NULL
      ) b
    ),
    'debts', (
      SELECT COALESCE(jsonb_agg(to_jsonb(d)), '[]'::jsonb)
      FROM (
        SELECT id, creditor_name, total_amount, paid_amount, interest_rate, due_date, created_at
        FROM public.debts WHERE user_id = _target_user_id AND deleted_at IS NULL
      ) d
    ),
    'savings_goals', (
      SELECT COALESCE(jsonb_agg(to_jsonb(g)), '[]'::jsonb)
      FROM (
        SELECT id, name, target_amount, current_amount, status, deadline, created_at
        FROM public.savings_goals WHERE user_id = _target_user_id AND deleted_at IS NULL
      ) g
    ),
    'assets', (
      SELECT COALESCE(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
      FROM (
        SELECT id, name, asset_type, category, current_value, currency, created_at
        FROM public.assets WHERE user_id = _target_user_id
      ) a
    ),
    'ai_conversations', (
      SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.updated_at DESC), '[]'::jsonb)
      FROM (
        SELECT c.id, c.title, c.created_at, c.updated_at,
          (SELECT COUNT(*) FROM public.ai_messages m WHERE m.conversation_id = c.id) AS msg_count,
          (SELECT jsonb_agg(jsonb_build_object('role', m.role, 'content', LEFT(m.content, 500), 'created_at', m.created_at) ORDER BY m.created_at DESC)
             FROM (SELECT * FROM public.ai_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 20) m
          ) AS recent_messages
        FROM public.ai_conversations c
        WHERE c.user_id = _target_user_id
        ORDER BY c.updated_at DESC LIMIT 10
      ) c
    ),
    'families', (
      SELECT COALESCE(jsonb_agg(to_jsonb(f)), '[]'::jsonb)
      FROM (
        SELECT fg.id, fg.name, fg.currency, fm.role,
               (SELECT COUNT(*) FROM public.family_members WHERE group_id = fg.id) AS member_count
        FROM public.family_members fm
        JOIN public.family_groups fg ON fg.id = fm.group_id
        WHERE fm.user_id = _target_user_id
      ) f
    ),
    'devices', (
      SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.last_seen_at DESC), '[]'::jsonb)
      FROM (
        SELECT fingerprint, ip_address::text, user_agent, first_seen_at, last_seen_at
        FROM public.device_fingerprints WHERE user_id = _target_user_id
        ORDER BY last_seen_at DESC LIMIT 20
      ) d
    ),
    'recent_audit', (
      SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT event_type, event_subtype, status, ip_address::text, created_at, metadata
        FROM public.audit_logs
        WHERE user_id = _target_user_id OR actor_id = _target_user_id
        ORDER BY created_at DESC LIMIT 30
      ) a
    ),
    'usage_today', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('feature', feature, 'count', count)), '[]'::jsonb)
      FROM public.usage_counters WHERE user_id = _target_user_id AND day = CURRENT_DATE
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
