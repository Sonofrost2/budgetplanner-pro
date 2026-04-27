-- Vue agrégée des métriques de notifications (30 derniers jours)
CREATE OR REPLACE VIEW public.admin_notification_metrics
WITH (security_invoker = true)
AS
WITH days AS (
  SELECT generate_series(
    (CURRENT_DATE - INTERVAL '29 days')::date,
    CURRENT_DATE,
    '1 day'::interval
  )::date AS day
),
sent AS (
  SELECT
    sent_at::date AS day,
    channel,
    COUNT(*)::int AS sent_count
  FROM public.notification_history
  WHERE sent_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY sent_at::date, channel
),
queue_stats AS (
  SELECT
    created_at::date AS day,
    channel,
    COUNT(*) FILTER (WHERE status = 'pending')::int AS queued_pending,
    COUNT(*) FILTER (WHERE status = 'sent')::int AS queued_sent,
    COUNT(*) FILTER (WHERE status = 'failed')::int AS queued_failed,
    COUNT(*) FILTER (WHERE status = 'cancelled')::int AS queued_cancelled
  FROM public.notification_queue
  WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY created_at::date, channel
),
resolutions AS (
  SELECT
    resolved_at::date AS day,
    COUNT(*)::int AS auto_resolved_count,
    COALESCE(SUM(cancelled_count), 0)::int AS cancelled_alerts_total
  FROM public.alert_resolutions
  WHERE resolved_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY resolved_at::date
)
SELECT
  d.day,
  COALESCE(s.channel, qs.channel, 'all') AS channel,
  COALESCE(s.sent_count, 0) AS sent_count,
  COALESCE(qs.queued_pending, 0) AS queued_pending,
  COALESCE(qs.queued_sent, 0) AS queued_sent,
  COALESCE(qs.queued_failed, 0) AS queued_failed,
  COALESCE(qs.queued_cancelled, 0) AS queued_cancelled,
  COALESCE(r.auto_resolved_count, 0) AS auto_resolved_count,
  COALESCE(r.cancelled_alerts_total, 0) AS cancelled_alerts_total
FROM days d
LEFT JOIN sent s ON s.day = d.day
FULL OUTER JOIN queue_stats qs ON qs.day = COALESCE(s.day, d.day) AND qs.channel = s.channel
LEFT JOIN resolutions r ON r.day = d.day
ORDER BY d.day DESC, channel;

-- Fonction RPC pour récupérer les métriques (admin only)
CREATE OR REPLACE FUNCTION public.get_notification_metrics(days_back integer DEFAULT 30)
RETURNS TABLE (
  day date,
  channel text,
  sent_count int,
  queued_pending int,
  queued_sent int,
  queued_failed int,
  queued_cancelled int,
  auto_resolved_count int,
  cancelled_alerts_total int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  WITH days AS (
    SELECT generate_series(
      (CURRENT_DATE - (days_back - 1) * INTERVAL '1 day')::date,
      CURRENT_DATE,
      '1 day'::interval
    )::date AS d
  ),
  sent AS (
    SELECT
      sent_at::date AS d,
      nh.channel AS ch,
      COUNT(*)::int AS sent_count
    FROM public.notification_history nh
    WHERE sent_at >= CURRENT_DATE - days_back * INTERVAL '1 day'
    GROUP BY sent_at::date, nh.channel
  ),
  queue_stats AS (
    SELECT
      created_at::date AS d,
      nq.channel AS ch,
      COUNT(*) FILTER (WHERE status = 'pending')::int AS queued_pending,
      COUNT(*) FILTER (WHERE status = 'sent')::int AS queued_sent,
      COUNT(*) FILTER (WHERE status = 'failed')::int AS queued_failed,
      COUNT(*) FILTER (WHERE status = 'cancelled')::int AS queued_cancelled
    FROM public.notification_queue nq
    WHERE created_at >= CURRENT_DATE - days_back * INTERVAL '1 day'
    GROUP BY created_at::date, nq.channel
  ),
  resolutions AS (
    SELECT
      resolved_at::date AS d,
      COUNT(*)::int AS auto_resolved_count,
      COALESCE(SUM(cancelled_count), 0)::int AS cancelled_alerts_total
    FROM public.alert_resolutions
    WHERE resolved_at >= CURRENT_DATE - days_back * INTERVAL '1 day'
    GROUP BY resolved_at::date
  ),
  combined AS (
    SELECT s.d, s.ch FROM sent s
    UNION
    SELECT qs.d, qs.ch FROM queue_stats qs
  )
  SELECT
    dd.d AS day,
    COALESCE(c.ch, 'push') AS channel,
    COALESCE(s.sent_count, 0) AS sent_count,
    COALESCE(qs.queued_pending, 0) AS queued_pending,
    COALESCE(qs.queued_sent, 0) AS queued_sent,
    COALESCE(qs.queued_failed, 0) AS queued_failed,
    COALESCE(qs.queued_cancelled, 0) AS queued_cancelled,
    COALESCE(r.auto_resolved_count, 0) AS auto_resolved_count,
    COALESCE(r.cancelled_alerts_total, 0) AS cancelled_alerts_total
  FROM days dd
  LEFT JOIN combined c ON c.d = dd.d
  LEFT JOIN sent s ON s.d = dd.d AND s.ch = c.ch
  LEFT JOIN queue_stats qs ON qs.d = dd.d AND qs.ch = c.ch
  LEFT JOIN resolutions r ON r.d = dd.d
  ORDER BY dd.d DESC, channel;
END;
$$;