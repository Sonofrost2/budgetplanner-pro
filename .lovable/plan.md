

## Plan : Chatbot IA financier, sous-pages modulaires, FAQ & Guide enrichi

### 1. Chatbot IA conseiller financier

**Edge Function `ai-chat`** : Nouvelle fonction backend qui reçoit l'historique de conversation + le contexte financier de l'utilisateur (comptes, budgets, epargne, transactions recentes, devise, localisation). Utilise Lovable AI (google/gemini-3-flash-preview) avec un prompt systeme de conseiller financier personnel. Supporte le streaming SSE.

**Composant `AIChatWidget`** : Bulle flottante en bas a droite du dashboard (type intercom). Au clic, ouvre un panneau de chat avec :
- Historique de messages (session locale, pas persiste en base)
- Streaming token par token avec markdown rendering (react-markdown)
- Suggestions rapides preconfigurees ("Comment optimiser mon epargne ?", "Quels investissements pour mon profil ?", "Analyser mes depenses")
- Le contexte utilisateur (resume comptes, budgets, epargne, devise, localisation) est envoye automatiquement au premier message

| Fichier | Action |
|---------|--------|
| `supabase/functions/ai-chat/index.ts` | Creer - edge function streaming |
| `supabase/config.toml` | Ajouter config ai-chat |
| `src/components/dashboard/AIChatWidget.tsx` | Creer - composant chat flottant |
| `src/components/dashboard/DashboardLayout.tsx` | Integrer AIChatWidget |

### 2. Sous-pages pour decentraliser les informations

Creer des sous-pages avec onglets/tabs dans les modules principaux pour eviter la surcharge :

**Comptes** (`/dashboard/accounts`) : Ajouter un onglet "Recapitulatif" avec graphique d'evolution des soldes par periode.

**Transactions** (`/dashboard/transactions`) : Ajouter un onglet "Statistiques" avec repartition par categorie, evolution temporelle.

**Budgets** (`/dashboard/budgets`) : Ajouter un onglet "Analyse" avec vue comparative budgets vs reel par periode.

**Epargne** (`/dashboard/savings`) : Ajouter un onglet "Projections" avec tableau de simulation et graphiques de progression.

L'approche utilise des **Tabs** dans chaque page existante plutot que des routes separees, pour garder la navigation simple.

| Fichier | Action |
|---------|--------|
| `src/pages/dashboard/AccountsPage.tsx` | Ajouter onglet Recapitulatif avec graphique evolution soldes |
| `src/pages/dashboard/TransactionsPage.tsx` | Ajouter onglet Statistiques |
| `src/pages/dashboard/BudgetsPage.tsx` | Ajouter onglet Analyse comparative |
| `src/pages/dashboard/SavingsPage.tsx` | Ajouter onglet Projections |

### 3. FAQ et Guide enrichis

Enrichir la page Guide existante (`GuidePage.tsx`) :

- **FAQ** : Ajouter 10+ questions supplementaires couvrant les fonctionnalites IA, les investissements, le chatbot, les sous-pages, la securite des donnees, le partage familial.
- **Guide** : Ajouter des sections pour le chatbot IA, les charges recurrentes, les sous-pages d'analyse.
- **Tutoriel** : Ajouter des etapes pour le chatbot et les nouvelles fonctionnalites.

| Fichier | Action |
|---------|--------|
| `src/pages/dashboard/GuidePage.tsx` | Enrichir FAQ + Guide + Tutoriel |
| `src/i18n/dashTranslations.ts` | Ajouter toutes les cles de traduction FR/EN |

### Resume des fichiers

| # | Fichier | Axe |
|---|---------|-----|
| 1 | `supabase/functions/ai-chat/index.ts` | Chatbot |
| 2 | `supabase/config.toml` | Chatbot |
| 3 | `src/components/dashboard/AIChatWidget.tsx` | Chatbot |
| 4 | `src/components/dashboard/DashboardLayout.tsx` | Chatbot |
| 5 | `src/pages/dashboard/AccountsPage.tsx` | Sous-pages |
| 6 | `src/pages/dashboard/TransactionsPage.tsx` | Sous-pages |
| 7 | `src/pages/dashboard/BudgetsPage.tsx` | Sous-pages |
| 8 | `src/pages/dashboard/SavingsPage.tsx` | Sous-pages |
| 9 | `src/pages/dashboard/GuidePage.tsx` | FAQ/Guide |
| 10 | `src/i18n/dashTranslations.ts` | Traductions |

