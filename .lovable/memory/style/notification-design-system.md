---
name: notification-design-system
description: Coach Financier visual system for in-app NotificationBell + email templates after the refonte
type: design
---
# Coach Financier — Notification & Email Design System

## NotificationBell (in-app)
- Popover: `rounded-3xl`, `bg-background/95 backdrop-blur-2xl`, shadow `shadow-2xl shadow-primary/10`
- Header: gradient `from-primary/10 via-primary/5 to-transparent`, brand pill (Bell icon in gradient bubble + "Coach Financier" tagline)
- Severity filter tabs: All / Critique / Alertes / Succès — pill tabs, active tab uses `bg-background ring-1 ring-border/60`
- Notification cards: `rounded-2xl`, gradient severity bar `border-l-[3px] bg-gradient-to-r from-{sev}/10 via-{sev}/5 to-transparent`
- Icon bubbles: 9×9, `rounded-xl`, severity-tinted (`bg-{sev}/15 ring-1 ring-{sev}/20`)
- Empty state: gradient blob halo behind CheckCircle2 icon — coach-tone copy "Tout est sous contrôle / Votre coach veille"
- Badge on bell: `animate-pulse` + `shadow-destructive/30` when critical

## Email templates (supabase/functions/send-email)
- Shell: 600px max, `border-radius: 20px`, soft layered shadow `0 8px 32px -8px rgba(108,60,240,0.18)`
- Hero: gradient banner per template (primary / success / warning / danger), with brand pill "💎 Coach Financier", giant emoji, then 26px H1 with `letter-spacing: -0.02em`
- Body: Space Grotesk font, 15px paragraphs `line-height: 1.65`
- Stat cards: `bg-#F9FAFB`, `border-radius: 14px`, rows separated by `border-top` of `#E5E7EB`
- Buttons: gradient pill, color-matched glow shadow `0 4px 16px -4px {accent}66`
- Footer: dual-column with brand left + "Préférences · domain" right
- 6 templates: confirm-signup, reset-password, payment-confirmation, welcome, weekly-summary, budget-alert
- Tone: warm, coach-led, emoji-anchored (🧭 hint, 🎉 win, ⚠️ caution, 🚨 danger)

## Toast helper (src/lib/coachToast.ts)
Unified API: `coachToast.win | saved | remind | warn | fail | money | coach`
Each variant prefixes with consistent emoji + sets coherent duration.
Use this instead of raw `toast.*` for user-facing financial events.
