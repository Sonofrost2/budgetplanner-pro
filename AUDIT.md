# Audit complet — Budget Planner Pro

**Date :** 30 juin 2026
**Périmètre :** Frontend (Vite/React/TS) + Backend (Supabase Edge Functions, RLS, RPC) + E2E + Perfs + SEO + i18n + a11y
**Méthode :** lint Supabase (46 findings), scan sécurité automatique, slow_queries pg_stat_statements, build production, vitest (9/9), Playwright E2E avec compte fictif `audit+xxx@budget-planner-pro.eurekaci.dev`, 2 sous-agents code-review (frontend + backend), revue manuelle ciblée.

## TL;DR — état de l'app

| Domaine | État | Note |
|---|---|---|
| Build production | ✅ OK | 25 s, PWA generateSW OK, 202 entries (4.6 MB precache) |
| Tests unitaires | ✅ 9/9 passent | `pricing.test.ts`, `no-hardcoded-currency.test.ts` |
| Auth signup E2E | ✅ Compte créé, email confirmation requise | Mail de confirmation reçu, login bloqué tant que non confirmé |
| Auth login non confirmé | ❌ 400 (attendu) | À expliquer dans l'UX (cf P1-12) |
| Slow queries DB | ⚠️ Volumes élevés, latence individuelle saine (moy 1-7 ms) | 4 271 appels sur la même requête transactions, à mettre en cache côté front |
| Sécurité backend | 🔴 **5 P0 réelles + 9 P1** | Voir section "Backend" |
| Sécurité frontend | 🟠 2 P0 (enforcement client-side) | Voir section "Frontend" |
| i18n FR/EN | 🟠 Couverture partielle | 359 occurrences inline `locale === 'fr' ? … : …` dans `AIChatWidget.tsx` |
| Accessibilité | 🟡 ~8 boutons icon-only sans `aria-label` | Conforme tokens, contraste OK |
| Bundle size | 🟡 Acceptable | jsPDF 416 kB, xlsx 429 kB, recharts 374 kB — déjà lazy-loadés |
| RLS coverage | ✅ Toutes les tables ont des policies | 46 warnings SECURITY DEFINER : la plupart légitimes (has_role, perform_transfer, RPCs admin) |
| Webhook Paystack | 🟠 Signature OK, idempotence partielle | Cf P0-05 backend |
| PWA / Capacitor | ✅ Production-ready | `server.url` retiré, `CAP_ENV=dev` opt-in |
| Réalisable pour commercialisation | ⛔ **Pas avant correction des 5 P0 backend** | 2 semaines de travail estimé |

---

## 🔴 P0 — Bloquants commercialisation (à corriger AVANT mise en vente)

### Backend (5)

| # | Fichier | Problème | Risque | Fix |
|---|---|---|---|---|
| **P0-B1** | migration `perform_transfer` | `INSERT INTO transactions (user_id) VALUES (p_user_id)` sans vérifier `auth.uid() = p_user_id` | Pollution du ledger d'un autre user, bypass quota Free | `IF p_user_id <> auth.uid() THEN RAISE EXCEPTION 'Forbidden'; END IF;` en tête |
| **P0-B2** | `supabase/functions/notify-user/index.ts:65` | Pas d'auth, accepte `user_id` arbitraire, dispatche push/SMS/email | Spam / coût Twilio illimité par tout caller anonyme | Soit Bearer service-role uniquement, soit `verify_jwt = true` + check rôle |
| **P0-B3** | `supabase/functions/send-email/index.ts:338` | Pas d'auth, template `generic` accepte HTML libre | **Open mail relay** depuis `noreply@budget-planner-pro.eurekaci.dev` (phishing) | Service-role Bearer obligatoire ou JWT vérifié |
| **P0-B4** | `supabase/config.toml` (25+ entrées) | `verify_jwt = false` global incl. fonctions sensibles | Une seule erreur de code = bypass complet | Réactiver `verify_jwt = true` partout sauf `paystack-webhook` et `twilio-status-webhook` |
| **P0-B5** | `supabase/functions/paystack-webhook/index.ts:141-191` | Activation sub par `status IN ('pending') ORDER BY created_at DESC LIMIT 1` (pas par `reference`) | Replay Paystack (72 h) peut réactiver/étendre une sub | Ajouter `AND last_payment_token = reference` + verrou advisory lock sur `reference` |

### Frontend (2)

| # | Fichier | Problème | Risque | Fix |
|---|---|---|---|---|
| **P0-F1** | `src/hooks/useSubscription.tsx:52-84` | `isPremium`, `canUse*` dérivés d'un `useState` client | Mutation JS = accès gratuit à toutes les features payantes (AI, exports, wealth, family) | Toutes les capacités payantes doivent être gated **côté serveur** (edge function + RLS) ; le flag client n'est que pour l'UX |
| **P0-F2** | `src/hooks/useAuth.tsx:82-98` | `setTimeout(800ms)` pour persister consentement RGPD post-signup | Échec silencieux possible (réseau, fermeture onglet) → consentement perdu | Trigger DB côté serveur ou edge function appelée explicitement |

---

## 🟠 P1 — Majeurs (correction sous 4 semaines)

### Backend

- **P1-B1** `admin-user-action` `get_user_snapshot` — pas d'audit log (RGPD Art. 5(1)(f)). Ajouter `audit()` inconditionnel.
- **P1-B2** `admin-user-action` `impersonate` — magic link retourné dans réponse HTTP. Envoyer par email à l'admin à la place.
- **P1-B3** `send-sms` — pas de validation E.164 ni rate-limit ; peut être utilisé comme SMS spam tool aux frais Twilio.
- **P1-B4** `paystack-checkout` — service-role client utilisé pour valider un JWT puis pour les writes ; un oubli de `.eq("user_id", user.id)` = RLS bypass.
- **P1-B5** Messages d'erreur DB renvoyés tels quels (`{ error: err.message }`) dans `paystack-webhook`, `delete-account`, `admin-user-action`, `send-family-invitation`. Mapper vers messages génériques.
- **P1-B6** `ai-chat` / `ai-categorize` — prompt injection : `description` et `context` interpolés directement dans le system prompt.
- **P1-B7** Aucune validation Zod sur les payloads edge functions. Risque de DB errors silencieux + comportement non déterministe.
- **P1-B8** `_shared/requirePlan.ts:211` — retourne le client service-role aux callers ; toute query depuis `gate.supabase` bypass RLS.
- **P1-B9** `security-check` — `verify_jwt = false` + écriture libre dans `security_signals` ; un attaquant peut générer des signaux fraudeux VPN/Tor pour une cible.

### Frontend

- **P1-F1** `useRole.tsx:12` — admin gated client-side uniquement ; flash d'UI admin possible. Render blanc tant que la première fetch serveur n'a pas confirmé le rôle.
- **P1-F2** `App.tsx:62` — `QueryClient` sans config : retry 3×, gcTime 5 min, données en mémoire après logout. Ajouter `defaultOptions` + `queryClient.clear()` au logout.
- **P1-F3** `NotificationBell.tsx:107-132` — 8 queries parallèles dont `.limit(100000)` rejouées sur chaque realtime event. Migrer vers un RPC d'agrégation + cache React Query.
- **P1-F4** `AIChatWidget.tsx` — 359 occurrences de `locale === 'fr' ? … : …` inline. Extraire vers `dashT.ai.*`.
- **P1-F5** `App.tsx:5,134` — pas de React Router v7 future flags ; 2 warnings console à chaque chargement. Ajouter `future={{ v7_startTransition: true, v7_relativeSplatPath: true }}`.
- **P1-F6** Couleurs chart hardcodées dupliquées dans `ReportsPage.tsx:25`, `CategoriesPage.tsx:38`, `AdminNotificationMetricsPage.tsx:41-42`, `DashboardHome.tsx:204` — utiliser `chartColors.ts`.
- **P1-F7** `chartColors.ts:7-21` — `CHART_GRID` et `CHART_AXIS` en HSL littéral, restent clairs en dark mode. Remplacer par `hsl(var(--border))`.
- **P1-F8** `validationSchemas.ts:19-52` — i18n inline dans Zod schemas. Threader un objet `t` (déjà fait pour transactions/budgets, à étendre).
- **P1-F9** `useSubscription` ne souscrit pas au realtime ; un paiement confirmé dans un autre onglet ne met pas à jour le tier sans reload.
- **P1-F10** Strings hardcodés dans `HeroSection`, `Footer`, `Navbar`, `DashboardLayout`, `MobileBottomNav`, `SyncStatusIndicator`, `AdminBillingPage` — ~25 occurrences listées. Centraliser dans `translations.ts` / `dashTranslations.ts`.
- **P1-F11** `useProfile.tsx:11` queryKey `'profile-currency'` ≠ `queryKeys.profile(userId)` ailleurs → deux caches divergents, currency ne se rafraîchit pas après modif Settings.
- **P1-F12** `AccountsPage.tsx:726-742` + `ReceiptsPage.tsx:20` — HTML d'impression avec hex hardcodés, ne respecte pas le thème ni la locale.

### UX / Auth

- **P1-12** Après signup, l'UI annonce "Vérifiez votre email" mais aucune indication de quoi faire si l'email n'arrive pas (renvoyer, vérifier spam, changer d'adresse). Ajouter bouton "Renvoyer le lien" lié à `supabase.auth.resend()`.

---

## 🟡 P2 — Mineurs (backlog, sous 2-3 mois)

- **P2-1** `min-h-screen` dans 20+ fichiers : iOS Safari clippe le contenu sous la toolbar. Remplacer par `min-h-dvh`.
- **P2-2** 8 boutons icon-only sans `aria-label` : `Navbar` (theme/lang/menu), `DashboardLayout` (search), `AIChatWidget` (close), `FamilyMembersTab` (utilise `title=` non WCAG), `AppSidebar` (lang toggle), `MobileBottomNav` (close).
- **P2-3** `TestimonialsSection.tsx:13` — `aria-label="Témoignages clients"` hardcodé FR.
- **P2-4** `getAnnualTotal` arrondit toujours à l'entier ; EUR 9.99 × 12 × 0.8 = 95.904 affiché 96 € mais Paystack peut facturer 95.90.
- **P2-5** `WealthPage.tsx:41` — `Lock` importé en double.
- **P2-6** `paystack-webhook` et `delete-account` ont `Access-Control-Allow-Origin: *` ; appliquer le pattern `buildCorsHeaders(req)` de `paystack-checkout`.
- **P2-7** Migration `20260308165539` — `payment_method DEFAULT 'paydunya'` (PayDunya n'est pas intégré). Changer en `NULL` ou `'unknown'`.
- **P2-8** `perform_transfer` — pas de borne supérieure sur `p_amount`. Ajouter `IF p_amount > 999_999_999 THEN RAISE EXCEPTION …`.
- **P2-9** `ai-chat:110` — `messages` array sans limite ; capper à 50 items, 8 000 chars chacun.
- **P2-10** `admin_list_payment_receipts` — `p_limit` sans cap ; `p_limit := LEAST(COALESCE(p_limit,500),1000)`.
- **P2-11** `requirePlan.ts:180` — quota RPC error → continue en illimité. Fail closed (503).
- **P2-12** `_shared/pricing.ts:6` — `ANNUAL_DISCOUNT_RATE` dupliqué client/serveur. Fetcher depuis `subscription_plans` côté front.
- **P2-13** `i18n/pages/` — couverture absente pour AboutPage, BlogPage, ContactPage, LegalPage, OnboardingPage, GuidePage, ReceiptsPage, DebtsPage, RecurringPage.
- **P2-14** 25 fichiers importent `recharts` eagerly ; wrap les charts dans `React.lazy`.
- **P2-15** Slow queries — top 2 queries (`transactions` filtré par date) totalisent 32 s sur 8 500 appels (moy < 4 ms). Pas urgent ; mais le pattern indique trop de refetch côté front : utiliser `staleTime: 30_000` dans React Query.

---

## Résultats E2E avec compte fictif

**Compte créé :** `audit+c7fea3@budget-planner-pro.eurekaci.dev`
- profil créé : `5b7ba6a2-00ff-423b-bf56-e0503af27812` (display name `Audit User c7fea3`)
- email **non confirmé** → login impossible → parcours authentifié non testé E2E
- `auth.users` n'est pas accessible via psql (permission denied) ; **action requise** : appeler `admin-user-action` ({ action: "delete_user", user_id: "5b7ba6a2-00ff-423b-bf56-e0503af27812" }) depuis ton compte admin pour purger.

### Pages testées (chargement sans auth → redirect /login attendu)

| Route | Chargement | Redirect /login | Erreur visible |
|---|---|---|---|
| `/` | ✅ titre OK | n/a | aucune |
| `/signup` | ✅ | n/a | aucune |
| `/login` | ✅ | n/a | aucune |
| `/dashboard/*` (12 routes) | ✅ | ✅ (comportement attendu) | aucune |

### Captures d'écran

13 screenshots stockés dans `/tmp/browser/e2e/screenshots/` (P_home.png, P_tx.png, etc.). À noter visuellement :
- Page signup : layout cohérent, PasswordField avec strength meter visible.
- Toast "Vérifiez votre email" affiché après signup → UX OK mais pas de bouton "Renvoyer" (cf P1-12).
- Page login : champ password ne se distingue pas visuellement quand vide (lighten focus).

---

## Plan de correction concret (90 jours)

### Sprint 1 (semaines 1-2) — Sécurité backend P0 (bloquant commercialisation)

- [ ] **P0-B1** Migration : `perform_transfer` check `auth.uid() = p_user_id` + borne `p_amount` (P2-8 ensemble)
- [ ] **P0-B2** `notify-user` : exiger Bearer service-role OU re-activer `verify_jwt`
- [ ] **P0-B3** `send-email` : même fix que B2
- [ ] **P0-B4** `supabase/config.toml` : passer en revue les 25+ entrées `verify_jwt`, ne laisser à `false` que les vrais webhooks
- [ ] **P0-B5** `paystack-webhook` : lookup sub via `last_payment_token = reference` + advisory lock
- [ ] Tests Deno : ajouter un test par fonction edge ré-activée pour vérifier le 401 anonyme
- [ ] Re-scan sécurité après corrections

**Estimation :** ~10 jours dev senior. **Sans ces fixes, ne pas commercialiser.**

### Sprint 2 (semaines 3-4) — P0 frontend + P1 backend critiques

- [ ] **P0-F1** Bouger toutes les feature gates (AI, export, wealth, family) côté serveur (edge function check + RLS)
- [ ] **P0-F2** Trigger DB pour persister consentement RGPD (remplacer `setTimeout`)
- [ ] P1-B3 `send-sms` : validation E.164 + caller==phone + rate-limit
- [ ] P1-B4 `paystack-checkout` : séparer client anon (auth) et service-role (writes)
- [ ] P1-B5 Mapper erreurs DB vers messages user-safe
- [ ] P1-B6 Sanitize prompts AI (boundary tokens)
- [ ] P1-B7 Schémas Zod sur tous les payloads edge functions
- [ ] P1-B8 `requirePlan` retourne anon-client pour data ops
- [ ] P1-B9 `security-check` : `verify_jwt = true` + rate-limit IP

**Estimation :** ~10 jours.

### Sprint 3 (semaines 5-6) — P1 frontend & UX

- [ ] P1-F1 useRole : blocking state until server confirms
- [ ] P1-F2 QueryClient defaults + clear on logout
- [ ] P1-F3 NotificationBell : RPC d'agrégation, cache React Query
- [ ] P1-F5 Future flags React Router
- [ ] P1-F6/F7 Chart colors via design tokens
- [ ] P1-F9 useSubscription realtime
- [ ] P1-F11 Unify profile queryKey
- [ ] P1-12 Renvoi email de confirmation après signup
- [ ] P2-1 `min-h-screen` → `min-h-dvh` globalement
- [ ] P2-2 a11y : aria-label sur tous les icon buttons

**Estimation :** ~8 jours.

### Sprint 4 (semaines 7-12) — P1-F10 + P2 + qualité long-terme

- [ ] P1-F4/F10 + P2-13 : refonte i18n (extraire les 359 inline + couverture pages manquantes)
- [ ] P1-F8 + P2-5 i18n schemas + dead imports
- [ ] P2-3, P2-7, P2-8, P2-10, P2-12 (nettoyages backend)
- [ ] P2-14 Lazy-load recharts par boundary
- [ ] P2-15 staleTime React Query
- [ ] Tests E2E Playwright automatisés sur compte démo (signup → confirmation simulée via SQL admin → parcours dashboard → suppression)
- [ ] Augmenter couverture tests unitaires (objectif 60% sur `src/lib/*` et hooks de business logic)

**Estimation :** ~15 jours répartis sur 6 semaines.

---

## Notes de méthodologie

- **Limites de cet audit :**
  - Le parcours dashboard authentifié n'a pas pu être validé E2E car la confirmation email est obligatoire et le sandbox n'a pas accès au mailbox du compte test.
  - Les 359 occurrences inline FR/EN dans `AIChatWidget` n'ont pas été lues une à une — comptage par grep.
  - Les 46 SECURITY DEFINER warnings du linter Supabase ne sont **pas** des P0 — la plupart sont des fonctions légitimes (`has_role`, RPCs admin, `update_updated_at`) qui DOIVENT être SECURITY DEFINER pour fonctionner. Seul `perform_transfer` (P0-B1) est un vrai problème dans cette liste.

- **Ce qui a été vérifié :**
  - Build production : ✅
  - PWA generateSW + manifest : ✅
  - Capacitor config (server.url retiré en prod) : ✅
  - Stratégie de pricing centralisée (`src/lib/pricing.ts` + `supabase/functions/_shared/pricing.ts`) : ✅
  - Annual billing 365 jours : ✅ (test `billing_cycle_test.ts`)
  - HIBP password protection : ⚠️ à confirmer dans Cloud → Users → Auth Settings
  - Sitemap.xml + robots.txt : ✅
  - CSP / Security headers : ✅ via `public/_headers`

- **Compte test à supprimer :** `5b7ba6a2-00ff-423b-bf56-e0503af27812` (email `audit+c7fea3@…`)
  - Profile en `public.profiles`
  - User en `auth.users` (non confirmé — sera auto-purgé par Supabase après inactivité, ou supprimable via `admin-user-action`)
