# Budget Planner Pro

Application bilingue (FR/EN) de gestion budgétaire intelligente pour l'Afrique de l'Ouest (XOF/XAF).
Coach Financier IA, suivi multi-comptes, budgets, épargne, patrimoine, rapports PDF/CSV et paiements Mobile Money / Carte via Paystack.

- **Preview** : https://id-preview--2f84ea3c-29cc-4df2-ab1d-da5d2ef488ee.lovable.app
- **Production** : https://budgetplanner-pro.lovable.app
- **Domaine custom** : https://budget-planner-pro.eurekaci.dev

## Stack

- Vite 5 · React 18 · TypeScript 5 · Tailwind CSS v3 · shadcn-ui
- Lovable Cloud (Supabase) — Auth, Postgres + RLS, Edge Functions, Realtime, Storage
- Capacitor (APK Android / IPA iOS), PWA installable
- Paiements : Paystack (Mobile Money + Carte)

## Développement local

Prérequis : Node.js 20+ et npm (ou bun).

```sh
git clone <YOUR_GIT_URL>
cd budget-planner-pro
npm install
npm run dev
```

L'app démarre sur `http://localhost:8080`. Les variables d'environnement (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, etc.) sont gérées via Lovable Cloud — ne jamais committer `.env`.

## Scripts utiles

- `npm run dev` — serveur Vite avec HMR
- `npm run build` — build de production
- `npm run preview` — prévisualisation du build
- `npx vitest run` — tests unitaires (front + facturation)

## Tests

- Front : `npx vitest run`
- Edge functions : tests Deno dans `supabase/functions/**/*_test.ts`

## Déploiement

L'app est déployée via Lovable. Pour publier : ouvrir le projet sur Lovable, cliquer **Publish**.
