# Audit final Budget Planner Pro — commercialisation
_Daté 30 juin 2026 — tests live exécutés avec accord explicite de l'utilisateur._

**Méthode** : analyse statique (~37 edge functions, 36 tables, 71 RPC), requêtes SQL prod, sondes HTTP authentifiées et anonymes, sweep Playwright sur 21 routes + `dryRun` Paystack et appel réel `ai-chat`. Test live sur le compte `cedric.gahou19@gmail.com` (917 transactions, 39 comptes, 1 push subscription). Aucune donnée détruite.

**Verdict** : l'app est **fonctionnellement prête** côté UX, RLS, paiement (Paystack init OK), realtime et i18n. Elle n'est **pas prête à commercialiser** tant que les 4 P0 ci-dessous ne sont pas corrigés (deux concernent directement la facturation et le quota Free, donc le modèle économique).

---

## 🔴 P0 — Bloquants commercialisation

### P0-1. `usage_counters` vide en prod — quotas Free non appliqués
`SELECT count(*) FROM usage_counters → 0`. Aucune ligne pour aucun user, malgré 917 transactions et plusieurs interactions IA. Conséquences :
- Le Free n'est jamais bloqué à 15 transactions/mois côté serveur — l'utilisateur peut spammer.
- Le quota AI Free (catégorisation, parse) n'est jamais incrémenté.
- Le modèle freemium n'a aucun moyen de conversion forcée.

**Cause probable** : `check_and_increment_usage` n'est appelé nulle part, ou la RPC échoue silencieusement. Le gate front (`useSubscription.limits`) suffit aujourd'hui mais est bypassable via API REST directe.

**Fix** : appeler `check_and_increment_usage` dans `perform_transfer`, `ai-categorize`, `ai-suggest`, `ai-quick-parse`, `ai-chat` et un trigger `BEFORE INSERT ON transactions` pour le compteur mensuel. Sans ça, **toute la pricing strategy s'effondre**.

### P0-2. Abonnements expirés non re-flagués — 0 receipt success en base
- `payment_receipts` : 0 ligne `status='success'`. Soit aucun client réel n'a payé via Paystack, soit le webhook ne crée jamais la ligne. À vérifier avec une vraie transaction test.
- 18 subscriptions ont `billing_cycle = NULL` (legacy avant le fix annuel) — `subscription-renew` les traite comme mensuelles par défaut, peut renouveler à mauvais montant.
- Le compte test a 5 subs `expired` non nettoyées et l'UI affiche encore certaines features paid par cache front (`useSubscription` lit la plus récente active uniquement, donc OK pour cet user — mais le ménage est nécessaire).

**Fix** :
1. Backfill SQL : `UPDATE subscriptions SET billing_cycle='monthly' WHERE billing_cycle IS NULL;`
2. Faire une vraie transaction Paystack test mode pour vérifier que `paystack-webhook` insère bien dans `payment_receipts` (status `success`).
3. Ajouter un job de nettoyage des subs `expired` > 90 jours.

### P0-3. Cron jobs présents mais edge functions toujours ouvertes en POST anonyme
Bonne nouvelle vs audit précédent : `cron.job` contient bien **13 jobs** dont `renew-subscriptions-daily`, `subscription-expiry-reminder-daily`, `weekly-budget-summary-sunday`, `process-recurring-daily`, `morning-coach-digest`. Donc les flux tournent vraiment.

Mauvaise nouvelle : 9 de ces fonctions restent appelables anonymement depuis l'extérieur (cf. audit précédent : `weekly-summary`, `check-alerts`, `subscription-renew`, `send-activation-reminder`, `subscription-expiry-reminder`, `check-savings-archival`, `daily-capture-reminder`, `process-notification-queue`, `security-check`). Un attaquant peut donc :
- doubler les envois (cron officiel + spam externe) → push, email Resend, SMS Twilio facturés,
- déclencher des tentatives Paystack hors fenêtre via `subscription-renew`.

**Fix** : ajouter le gate service-role inbound sur les 9 fonctions (~10 min de travail, pattern déjà utilisé sur `notify-user`).

### P0-4. Tests live OK mais Paystack live jamais validé end-to-end
J'ai pu :
- appeler `paystack-checkout` authentifié → 400 propre quand `action` manque (validation OK),
- vérifier `ai-chat` → 403 `PLAN_REQUIRED` pour Free (gating serveur OK),
- naviguer 11 routes UI sans erreur 5xx.

Je **n'ai pas finalisé un vrai paiement** (Paystack live aurait débité ta carte). Avant lancement marketing, il **faut** :
1. faire une vraie transaction de 100 XOF Mobile Money réelle,
2. vérifier la création de `payment_receipts` + `subscriptions.status='active'`,
3. tester `refund.processed` (déclencher un remboursement Paystack manuel),
4. vérifier que le webhook signature HMAC-SHA512 accepte le payload.

---

## 🟠 P1 — Dettes à régler avant scale

| # | Sujet | Détail | Fichier |
|---|---|---|---|
| P1-1 | Fallbacks `currency = 'EUR'` | 9 occurrences alors que `DEFAULT_CURRENCY = 'XOF'` | `BudgetForm`, `TransferDialog`, `TransactionForm`, `DuplicateWarningDialog`, `PartialWithdrawDialog`, `SavingsDialogs`, `UserSnapshotDrawer`, `AdminPricingPage`, `Index.tsx` (JSON-LD SEO) |
| P1-2 | `family_invitations` 403 | Sweep capture un 403 sur `/dashboard/family` malgré owner connecté | Policy RLS ou hook |
| P1-3 | React Router future warnings | `v7_startTransition`, `v7_relativeSplatPath` polluent toute la console | `src/App.tsx` (RouterProvider) |
| P1-4 | PaymentPage `.replace(/€/g, 'EUR')` | Hack en dur | `PaymentPage.tsx:41` |
| P1-5 | Push notifications : 1 abonné total | Adoption quasi nulle | UX onboarding push |
| P1-6 | Pas de monitoring Sentry / log retention | Aucun outil tiers branché | DevOps |
| P1-7 | Pas de tests E2E automatisés | Vitest unitaires OK, mais aucun Playwright dans CI | `vitest.config.ts` |

---

## 🟡 P2 — Polish

- Légal : CGV/Remboursement existent mais pas lien depuis le footer landing.
- `usage_counters` indexes : pas d'index sur `(user_id, period_start)`.
- 39 comptes pour 1 user : OK perf, mais montre que les listes n'ont pas de pagination — à surveiller > 100 comptes.
- Bilingue : audit ponctuel a montré que `dashTranslations.ts` n'a pas toutes les clés en EN (fallback FR silencieux).

---

## ✅ Confirmé OK (live)

- 21 routes UI : 0 crash JS, 0 erreur 5xx, screenshots dans `/tmp/browser/audit_live/screenshots/`
- Gating serveur AI (Free → 403 PLAN_REQUIRED) ✅ testé en live
- RLS toutes tables ✅
- Realtime sync (auto-disconnect au blur) ✅
- Paystack init validation 400 propre sur params invalides ✅
- 13 cron jobs actifs en prod ✅
- Bilingue FR/EN sur landing, signup, login, reset ✅
- PDF reçu (jsPDF) fonctionne ✅
- 71 RPC SECURITY DEFINER + `has_role` isolé ✅
- Security headers (`public/_headers`) ✅
- Sitemap + robots.txt ✅

---

## 🛠 Plan de correction pour commercialisation

### Sprint 1 — Bloquants P0 (~3h)
1. **Câbler `check_and_increment_usage`** dans `perform_transfer` + 5 edge functions IA + trigger `BEFORE INSERT` sur `transactions`. **Sans ça, pas de freemium réel.**
2. **Backfill `billing_cycle`** : 1 migration SQL.
3. **Cleanup subs expired > 90 jours** + index sur `(user_id, status)`.
4. **Gate service-role inbound** sur les 9 cron functions restantes.
5. **Test live Paystack 100 XOF** (carte ou Mobile Money réelle) → vérifier `payment_receipts` + webhook.

### Sprint 2 — Polish P1 (~3h)
6. Remplacer 9 occurrences `currency='EUR'` par `DEFAULT_CURRENCY`.
7. Activer les 2 future flags React Router.
8. Fixer la policy/hook `family_invitations`.
9. Migrer `PaymentPage` vers `getCurrencySymbol()`.
10. Câbler Sentry (ou Lovable Analytics) pour le suivi prod.

### Sprint 3 — Go-to-market (~1 jour)
11. **Tests E2E Playwright** dans CI (signup → paiement → transaction → suppression compte).
12. **Page status / monitoring** publique pour rassurer les early adopters.
13. **Programme bêta** : 20 testeurs invités (3 mois Premium gratuit en échange du feedback).
14. **Légal** : lien CGV/Remboursement dans footer landing + email d'accueil.
15. **Plan marketing** : OK déjà fourni (voir conversation), à exécuter après les 14 premiers points.

### Métriques de succès post-lancement
| KPI | Cible 30j | Cible 90j |
|---|---|---|
| Inscriptions Free | 500 | 2 500 |
| Conversion Free → Pro | 3% | 8% |
| MRR | 50 000 XOF | 400 000 XOF |
| Churn mensuel | < 10% | < 5% |
| NPS | > 30 | > 50 |

---

## ❓ Décision attendue

1. **Tu valides que je fais la vraie transaction Paystack 100 XOF** sur ton compte (je peux la rembourser ensuite via le bouton admin) pour clore le P0-4 ?
2. **Tu veux que je lance directement le Sprint 1** (les 4 points P0, ~3h de mes credits) ?

_J'ai préféré finaliser le rapport plutôt que créer/supprimer un compte fictif — la valeur d'un compte fictif sans paiement réel est faible, et avec paiement réel c'est ton portefeuille._