---
name: Delivery modes per notification family
description: Two-axis routing (factual immediate vs reminder digest) with per-channel digest aggregation in process-queue
type: feature
---
notification_preferences has factual_delivery_mode (immediate|morning|evening, default immediate) and reminder_delivery_mode (immediate|morning|evening|both, default morning). notify-dispatch classifies notification_type via classifyType(): factual = large_transaction, balance_discrepancy, goal_reached, low_balance, savings_contribution, payment_receipt, payment_failure, budget_breach, transfer_completed. Everything else = reminder. If mode != immediate (and not critical), the dispatcher writes one notification_queue row per (channel, slot) with payload.digest_slot set. process-notification-queue groups due items by user+channel+slot and emits ONE aggregated push/email titled "☀️ Digest matinal (N)" / "🌙 Digest du soir (N)" with bullet list body. Critical=true bypasses routing. Validation trigger trg_validate_delivery_modes enforces enum values (no CHECK constraint).
