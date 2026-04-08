

# Plan : Refonte UX/UI de tous les formulaires de l'application

## Contexte

Les formulaires actuels sont fonctionnels mais souffrent de plusieurs problemes d'experience utilisateur :
- Design plat et monotone (Label + Input empiles sans hierarchie visuelle)
- Pas de sections visuellement distinctes dans les formulaires denses (Epargne, Patrimoine, Budgets)
- Inconsistance entre les modules : certains utilisent `ResponsiveFormDialog`, d'autres `Dialog` brut
- Les inputs manquent d'icones inline, de prefixes/suffixes (symbole monnaie, %), et de feedback visuel
- Les etats d'erreur sont minimalistes (juste un texte rouge)
- Pas de stepper ou de progression pour les formulaires longs
- Les boutons de type (Depense/Revenu, Max/Min) sont corrects mais le reste du formulaire ne suit pas ce niveau de polish

## Ce qui sera ameliore

### A. Composants de base enrichis (utilises partout)

1. **InputField enrichi** : nouveau composant wrapper autour de `Input` avec :
   - Icone a gauche (prefixe visuel)
   - Suffixe inline (ex: `%`, `FCFA`, `jours`)
   - Etat focus avec bordure gradient subtile
   - Compteur de caracteres pour les champs avec `maxLength`
   - Hint text sous le champ (texte d'aide contextuel)

2. **FormSection** : composant pour grouper les champs par section avec :
   - Titre de section avec icone
   - Ligne separatrice subtile
   - Possibilite de collapse (remplace les `<details>` bruts actuels)

3. **ResponsiveFormDialog ameliore** : 
   - Barre de progression en haut pour formulaires multi-sections
   - Animation d'entree plus fluide
   - Meilleur espacement et padding

### B. Refonte par module

**1. TransactionForm** (le plus utilise)
- Ajouter prefixe monnaie sur le champ montant
- Icone calendrier cliquable integree au champ date
- Meilleur feedback visuel sur le type selectionne (background plus visible)
- Champ notes avec icone et compteur de caracteres visible

**2. BudgetForm**
- Regrouper en 2 sections claires : "Configuration de base" et "Planification"
- Remplacer les `<details>` HTML par des sections `FormSection` collapsibles stylisees
- Ajouter suffixe `%` au champ seuil d'alerte
- Barre de preview "Impact" plus visible avec background gradient

**3. AccountsPage (formulaire compte)**
- Meilleure grille pour les types de compte (plus aeree)
- Selection d'icone avec highlight plus visible
- Prefixe monnaie sur le champ solde d'ouverture

**4. SavingsPage (formulaire objectif d'epargne)**
- Convertir de `Dialog` brut vers `ResponsiveFormDialog` (actuellement inconsistant)
- Remplacer les 2 `<details>` par des `FormSection` collapsibles
- Prefixe monnaie sur montants, suffixe `%` sur taux d'interet
- Barre de progression de l'objectif en preview dans le formulaire

**5. DebtsPage (formulaire dette)**
- Ajouter des icones aux champs
- Prefixe monnaie sur les montants
- Preview de la progression restante

**6. RecurringPage (formulaire recurrent)**
- Harmoniser avec le style TransactionForm
- Convertir vers `ResponsiveFormDialog` si ce n'est pas le cas

**7. CategoriesPage (formulaire categorie)**
- Grille d'icones plus aeree et scrollable
- Palette de couleurs plus visible avec preview de la couleur selectionnee

**8. WealthPage (formulaire actif patrimonial)**
- Sections collapsibles pour les details avances
- Prefixe monnaie sur les valeurs

**9. TransferDialog**
- Convertir vers `ResponsiveFormDialog` pour la coherence mobile
- Prefixe monnaie sur le montant

**10. SavingsDialogs (contribution/retrait)**
- Convertir vers `ResponsiveFormDialog`
- Prefixe monnaie

### C. Harmonisation globale

- Tous les formulaires utiliseront `ResponsiveFormDialog`
- Tous les champs monetaires auront un prefixe monnaie
- Tous les champs avec `maxLength` afficheront un compteur
- Tous les labels utiliseront la classe `.form-label` avec icones contextuelles
- Les boutons footer seront uniformes (Annuler outline + Action gradient)

## Fichiers concernes

- `src/components/ui/input-field.tsx` (NOUVEAU — wrapper enrichi)
- `src/components/ui/form-section.tsx` (NOUVEAU — section collapsible)
- `src/components/ui/responsive-form-dialog.tsx` (ameliore)
- `src/components/dashboard/transactions/TransactionForm.tsx`
- `src/components/dashboard/budgets/BudgetForm.tsx`
- `src/components/dashboard/TransferDialog.tsx`
- `src/components/dashboard/savings/SavingsDialogs.tsx`
- `src/pages/dashboard/AccountsPage.tsx`
- `src/pages/dashboard/SavingsPage.tsx`
- `src/pages/dashboard/DebtsPage.tsx`
- `src/pages/dashboard/RecurringPage.tsx`
- `src/pages/dashboard/CategoriesPage.tsx`
- `src/pages/dashboard/WealthPage.tsx`
- `src/index.css` (styles globaux pour les nouveaux composants)

## Approche

Implementation en 3 phases :
1. Creer les composants de base (`InputField`, `FormSection`, ameliorer `ResponsiveFormDialog`)
2. Refondre les 4 formulaires principaux (Transaction, Budget, Compte, Epargne)
3. Harmoniser les formulaires secondaires (Dettes, Recurrents, Categories, Patrimoine, Transfert, Dialogs epargne)

