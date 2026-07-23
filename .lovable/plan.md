
# Refonte complète — Module Catégories

Objectif : transformer la page en un vrai centre de gouvernance des catégories (taxonomie, santé, analytique, gouvernance IA), tout en gardant la charte glassmorphism dark existante (Space Grotesk, `--gradient-primary`, tokens sémantiques). Aucune régression sur la DB — juste des évolutions additives.

## 1. UX/UI — Page & navigation

**Hero header refondu (`CategoriesHeroHeader.tsx`)**
- 6 KPI au lieu de 4 : Actives · Racines · Profondeur max · Top dépense % · Inutilisées · Sans budget lié
- Chip "Score de taxonomie" (0–100) : pénalise doublons, catégories vides, hiérarchie plate, catégories sans couleur/icône par défaut.
- Sparkline top-5 avec dégradé + point final animé.
- Bouton "Nouvelle" en split-button : « Nouvelle » / « Depuis modèle » / « Import JSON ».

**Barre d'outils sticky + segments enrichis**
- Segment `Dépenses / Revenus / Toutes` (aujourd'hui : uniquement 2).
- Toggle vue : `Arborescence` / `Grille` / `Tableau compact` (persisté).
- Chips filtres actifs : « inutilisées », « racines seulement », « profondeur ≥ N », « avec budget », « famille » — tous cumulables et persistés.
- Densité `Compact / Confort` (persisté).

**Arborescence (`CategoryTreeView.tsx`)**
- Ligne enrichie : icône, nom, breadcrumb parent, badge N-niveau, badge budget lié 💰, badge partage famille, montant du mois + variation vs mois précédent (▲ ▼), % du type, mini-sparkline 6 mois, nombre de tx.
- Drag & drop amélioré : indicateur de drop **au-dessus / à l'intérieur / sur racine**, halo animé, aperçu du chemin cible dans un tooltip.
- Actions : expand-all / collapse-all, bouton « Ajouter un enfant » directement sur la ligne parent.
- Rappel de profondeur restante quand on approche du max (5).

**Vue Grille & Tableau**
- Grille : cartes 200×120 avec halo couleur, KPI mois + variation, actions rapides.
- Tableau : colonnes triables (Nom, Type, Parent, Tx, Total mois, Δ vs mois-1, Budget, Statut).

**Onglet Évolution enrichi**
- Sélecteur de période (30j / 3m / 6m / 12m / YTD / custom).
- Comparaison N/N-1, toggle « Empilé / Superposé / 100% ».
- Heatmap dépenses par catégorie × mois.
- Top mouvers (plus fortes hausses/baisses).

**Onglet Coach refondu (`CategoryCoachTab.tsx`)**
- 4 sections : Doublons potentiels · Inutilisées · Hiérarchie à plat · Catégories fourre-tout (« Autres »).
- Chaque suggestion devient **actionnable en un clic** : Fusionner, Archiver, Déplacer, Renommer.
- Cache des suggestions (ai_cache) pour éviter recalcul.

**Empty states & responsive**
- Empty states illustrés, CTA doubles, tips contextuels.
- Mobile : arborescence en accordéon plein écran, barre d'action flottante, drag & drop remplacé par sheet « Déplacer vers… ».

## 2. Formulaire unifié création/édition (`CategoryForm.tsx` — nouveau)

Extrait de `CategoriesPage.tsx` dans un composant dédié, servant à la fois création et édition.

- Zod schema centralisé dans `src/lib/validationSchemas.ts` (`categorySchema`) + React Hook Form.
- Aperçu live en haut (déjà présent, retravaillé) + preview « comme affichée dans une transaction ».
- Sélecteur parent en **combobox hiérarchique cherchable** (réutilise `CategoryCombobox`) avec badge de profondeur restante.
- Sélecteur d'icône : recherche + onglets (Finance / Vie quotidienne / Loisirs / Emojis récents).
- Palette couleurs élargie + picker HSL + « couleur du parent » (suggestion auto).
- Champs additionnels (optionnels, sans migration lourde — utilisent colonnes existantes ou tags) :
  - **Alias** (mots-clés pour l'auto-catégorisation IA) — stockés dans `tags`.
  - **Budget mensuel suggéré** (readonly info depuis les budgets liés).
- Validation :
  - Nom unique par type (pas globalement) — corrige un faux positif actuel.
  - Longueur, caractères, profondeur, cycle, type-parent cohérent.
  - Messages inline sous chaque champ.
- Bouton « Enregistrer et créer une sous-catégorie » (chain-create).

## 3. Actions puissantes

**Bulk actions étendues (`BulkActionBar` extras)**
- Fusionner N → 1 (existe, on améliore le dialog : compteur tx, aperçu impact).
- Déplacer sous un parent (bulk reparent — RPC déjà là, on ajoute picker hiérarchique).
- Archiver / Désarchiver / Supprimer en masse.
- Changer icône / couleur en masse.
- Export JSON de la sélection (en plus de CSV/Excel).

**Templates (`CategoryTemplatesDialog.tsx`)**
- Regrouper en packs : Ménage, Freelance, Famille, Étudiant, Auto-entrepreneur, Investissement.
- Preview des catégories avant application, cases à cocher individuelles, détection des doublons (skip auto).

**Import/Export**
- Import CSV en plus du JSON, mapping des colonnes.
- Export : JSON, CSV, Excel avec stats.
- Historique d'import récent (localStorage).

## 4. Analytique & Coach IA

**`categoryAnalytics.ts` — enrichi**
- Ajout : variation N vs N-1, part du type, part du total, tendance (regression linéaire slope), rang.
- Cache local via TanStack Query (staleTime 5 min).

**`CategoryEvolutionChart.tsx`**
- Multi-sélection catégories comparables (max 6, checkbox palette).
- Métriques : montant, nombre de tx, ticket moyen.
- Export PNG du graphique.

**Coach IA (edge function `ai-categories-suggest` — étendue)**
- Nouveau prompt structuré JSON : `duplicate`, `unused`, `flat_hierarchy`, `catch_all`, `rename`, `split`.
- Utilise `ai_cache` (clé = hash liste catégories + hash stats mensuelles).
- Actions server-safe : fusion et reparent via RPC existants.

## 5. Fichiers touchés

**Créés**
- `src/components/dashboard/categories/CategoryForm.tsx`
- `src/components/dashboard/categories/CategoryGridView.tsx`
- `src/components/dashboard/categories/CategoryTableView.tsx`
- `src/components/dashboard/categories/CategoryToolbar.tsx`
- `src/components/dashboard/categories/CategoryHealthScore.tsx`
- `src/components/dashboard/categories/CategoryCoachActionCard.tsx`
- `src/components/dashboard/categories/IconPickerAdvanced.tsx`

**Modifiés**
- `src/pages/dashboard/CategoriesPage.tsx` (allégé, orchestrateur uniquement)
- `src/components/dashboard/categories/CategoriesHeroHeader.tsx` (6 KPI + score)
- `src/components/dashboard/categories/CategoryTreeView.tsx` (KPI par ligne, DnD amélioré)
- `src/components/dashboard/categories/CategoryEvolutionChart.tsx` (comparaisons + heatmap)
- `src/components/dashboard/categories/CategoryCoachTab.tsx` (sections actionnables)
- `src/components/dashboard/categories/CategoryTemplatesDialog.tsx` (packs + preview)
- `src/components/dashboard/categories/MergeCategoriesDialog.tsx` (impact preview)
- `src/lib/categoryAnalytics.ts` (variation, tendance, score)
- `src/lib/validationSchemas.ts` (`categorySchema`)
- `src/i18n/dashTranslations.ts` (nouvelles clés FR/EN)
- `supabase/functions/ai-categories-suggest/index.ts` (prompt structuré + cache)

**Non touché**
- Schéma DB (aucune migration) — on reste sur les colonnes existantes.
- RLS, RPC `bulk_reparent_categories`, RPC `merge_categories`, triggers hiérarchie (déjà OK).

## 6. Détails techniques

- Persistance : `usePersistedState` pour vue, densité, chips filtres, période Évolution, sélection Comparaison.
- Perf : `useMemo` pour l'index d'arborescence, `React.memo` sur `CategoryNode`, virtualisation via `@tanstack/react-virtual` si > 100 catégories.
- Accessibilité : rôles ARIA `tree/treeitem`, focus visibles, raccourcis clavier (E=édit, D=supprimer, A=archiver, N=nouveau enfant, / focus recherche).
- Bilingue : chaque nouvelle clé ajoutée en FR + EN.
- Tests : `categorySchema.test.ts` (unique par type, longueurs, caractères, profondeur), `categoryAnalytics.test.ts` (score, variation).

## 7. Livraison

Le travail sera fait en 3 commits séquentiels :
1. **Fondations** — schema Zod, analytique enrichie, `CategoryForm`, i18n.
2. **UI page** — hero refondu, toolbar, vues Grille/Tableau, arborescence enrichie.
3. **Actions & Coach** — bulk étendus, templates packs, Coach actionnable, edge function.
