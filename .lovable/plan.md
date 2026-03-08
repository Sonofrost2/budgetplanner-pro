

## Plan: Améliorations UX avancées, suggestions IA, guide utilisateur et cohérence des plans

Ce plan couvre 5 axes majeurs : filtres/tri dynamiques, sélection multiple avec export, suggestions IA à la saisie, cohérence features/plans, et guide/FAQ/tutoriel.

---

### 1. Filtres dynamiques, tri et sélection multiple (TransactionsPage)

**Tri dynamique** : Ajouter un état `sortField` (date, amount, description) et `sortOrder` (asc/desc) avec un bouton de tri cliquable dans l'en-tête de la liste.

**Sélection par cases à cocher** :
- Ajouter un état `selectedIds: Set<string>` + checkbox "Tout sélectionner" en haut
- Checkbox individuelle sur chaque ligne de transaction
- Barre d'actions flottante quand sélection > 0 : "Exporter la sélection (CSV/Excel)", "Supprimer la sélection"
- Utiliser `exportToCSV` / `exportToExcel` sur le sous-ensemble sélectionné

**Améliorations recherche** :
- Recherche étendue aux notes, catégorie et compte (pas seulement description)
- Debounce de 300ms sur le champ de recherche
- Bouton "Effacer les filtres" visible quand des filtres sont actifs

**Fichiers modifiés** : `TransactionsPage.tsx`, `src/lib/export.ts` (ajout d'une fonction `exportSelection`)

---

### 2. Suggestions IA à la saisie (Pro/Premium uniquement)

**Edge function** `supabase/functions/ai-suggest/index.ts` :
- Reçoit les dernières transactions de l'utilisateur + le texte en cours de saisie
- Utilise Lovable AI (google/gemini-3-flash-preview) pour suggérer description, catégorie, montant
- Retourne un objet `{ description, category_id, amount, account_id }`

**Frontend** (dans le dialog d'ajout de transaction) :
- Bouton sparkle "✨ Suggestion IA" visible uniquement si `isPaid`
- Au clic : appelle l'edge function, pré-remplit le formulaire
- Auto-complétion de la description basée sur les transactions passées (local, sans IA) pour tous les utilisateurs
- L'IA suggère aussi la catégorie en fonction de la description saisie

**Fichiers** : nouveau `supabase/functions/ai-suggest/index.ts`, modifier `TransactionsPage.tsx`, mettre à jour `supabase/config.toml`

---

### 3. Cohérence features listées dans les plans

Audit actuel des fonctionnalités par plan dans `useSubscription` :

| Fonctionnalité | Free | Pro | Premium | Code |
|---|---|---|---|---|
| Transactions illimitées | Non (15/mois) | Oui | Oui | ✅ |
| Comptes illimités | Non (1) | Oui | Oui | ✅ |
| Budgets illimités | Non (1) | Oui | Oui | ✅ |
| Catégories illimitées | Oui (5 par défaut) | Oui | Oui | ⚠️ Pas de limite sur les catégories en Free |
| Exports CSV/Excel | Non | Oui | Oui | ✅ |
| Prévisions IA | Non | Non | Oui | ✅ |
| Gestion familiale | Non | Non | Oui | ✅ |
| Suggestions IA saisie | Non | Oui | Oui | 🆕 À implémenter |
| Guide/Tutoriel | Oui | Oui | Oui | 🆕 À créer |

**Actions** :
- Ajouter une limite de 5 catégories pour le plan Free dans `useSubscription`
- Ajouter `canUseAISuggestions: isPaid` dans le hook
- Mettre à jour `freeExcluded` / `proExcluded` dans les traductions pour refléter les features réelles
- S'assurer que la liste `features` des plans en DB correspond aux fonctionnalités réellement implémentées

---

### 4. Guide d'utilisation, FAQ et tutoriel

**Nouvelle page** `src/pages/dashboard/GuidePage.tsx` avec :

- **Onglet Guide** : Sections pliables (Accordion) expliquant chaque fonctionnalité
  - Premiers pas (comptes, catégories)
  - Gérer ses transactions
  - Créer et suivre des budgets
  - Objectifs d'épargne
  - Rapports et exports
  - Prévisions IA (Premium)
  - Gestion familiale (Premium)

- **Onglet FAQ** : Questions fréquentes
  - Comment changer ma devise ?
  - Comment exporter mes données ?
  - Comment fonctionne le solde théorique vs réel ?
  - Comment résilier mon abonnement ?
  - Mes données sont-elles sécurisées ?

- **Onglet Tutoriel** : Walkthrough interactif étape par étape avec des illustrations et des liens directs vers les pages concernées

**Route** : `/dashboard/guide` ajoutée dans `App.tsx`
**Navigation** : Ajouter un item "Guide" avec icône `HelpCircle` dans le sidebar secondaire de `DashboardLayout.tsx`
**Traductions** : Ajouter toutes les clés FR/EN dans `dashTranslations.ts`

---

### 5. Translations updates

Nouvelles clés à ajouter dans `dashTranslations.ts` :
- `sortBy`, `sortOrder`, `ascending`, `descending`, `selectAll`, `deselectAll`, `exportSelection`, `deleteSelection`, `clearFilters`, `aiSuggest`, `aiSuggesting`, `guide`, `faq`, `tutorial`, `gettingStarted`, etc.

---

### Ordre d'implémentation

1. Translations (fondation pour tout le reste)
2. Filtres/tri/sélection/export dans TransactionsPage
3. Cohérence des plans (useSubscription + features lists)
4. Edge function AI-suggest + intégration dans le formulaire
5. Page Guide/FAQ/Tutoriel + route + navigation

### Complexité

Environ 7-8 fichiers modifiés/créés. Le plus gros travail est TransactionsPage (sélection + tri + export) et la nouvelle GuidePage.

