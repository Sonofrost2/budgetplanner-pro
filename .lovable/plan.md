

## Plan : Corrections multi-modules (Epargne IA, Budget, Pricing, Affichage, Routes)

Ce plan couvre les 4 axes de la demande en 7 taches distinctes.

---

### I. Simulation d'epargne IA amelioree

**A. Taux d'interet bancaires integres**
- Ajouter dans l'Edge Function `ai-savings-simulate` un dictionnaire `BANK_RATES` avec les taux reels connus des banques listees (SGCI, BICICI, BOA, Ecobank, etc.) pour le marche UEMOA.
- Si `bank_name` correspond a une entree du dictionnaire et que le `interest_rate` fourni est 0, utiliser le taux de reference de la banque.
- Injecter ces donnees dans le prompt IA pour que les recommandations comparent le taux de l'utilisateur aux taux du marche.

**B. Calcul au prorata des jours**
- Remplacer le calcul mensuel actuel par un calcul journalier : interets = `solde * (taux_annuel / 365) * nombre_de_jours`.
- Prendre en compte `start_date` (ou date de cotisation) et `deadline` (ou 31/12/2026 par defaut) pour calculer le nombre exact de jours.
- Chaque cotisation mensuelle est ajoutee a sa date et les interets sont calcules au prorata a partir de cette date.

**C. Recommandations IA plus precises**
- Enrichir le prompt systeme avec les taux de reference du marche, le calcul prorata exact et les projections chiffrees.
- Demander des recommandations comparatives (taux actuel vs marche) et des actions concretes avec montants.

| Fichier | Action |
|---------|--------|
| `supabase/functions/ai-savings-simulate/index.ts` | Refonte calcul prorata + dictionnaire taux bancaires |

---

### II. Alerte de depassement budget volontaire

- Dans `TransactionsPage.tsx`, au moment de sauvegarder une depense : verifier si la categorie a un budget `max` et si le budget est deja atteint/depasse pour la periode.
- Si oui, afficher un **dialog de confirmation** : "Le budget [nom] est deja consomme a 100%. Souhaitez-vous quand meme imputer cette depense ? Cela creera un depassement volontaire."
- L'utilisateur peut confirmer ou annuler.

| Fichier | Action |
|---------|--------|
| `src/pages/dashboard/TransactionsPage.tsx` | Ajouter verification budget + dialog confirmation depassement |
| `src/pages/dashboard/BudgetsPage.tsx` | Aucun changement (les indicateurs existants gereront le depassement) |

---

### III. Tarification annuelle : afficher le montant total annuel

- Dans `PricingSection.tsx`, quand le toggle annuel est actif :
  - Calculer `montant_mensuel * 12 * 0.8` = montant total annuel avec reduction.
  - Afficher ce **montant total annuel** (ex: "86 304 CFA/an" au lieu de "7 192 CFA/mois") comme prix principal.
  - Garder le prix mensuel equivalent en petit sous le prix principal.
- Dans `PaymentPage.tsx`, le montant preleve en mode annuel sera le montant total annuel.

| Fichier | Action |
|---------|--------|
| `src/components/landing/PricingSection.tsx` | Afficher prix total annuel + equivalent mensuel |
| `src/pages/dashboard/PaymentPage.tsx` | Verifier que le montant annuel est correct au paiement |
| `src/i18n/translations.ts` | Ajouter cle `perYear` |

---

### IV. Affichage et formatage

**A. Formatage des montants**
- Auditer les composants qui affichent des montants sans passer par `fmt()` de `useProfile` et corriger.
- S'assurer que `fmt()` utilise `toLocaleString` avec separateurs de milliers et la devise configuree.

**B. Sous-pages pour decharger le dashboard**
- Creer une sous-page `/dashboard/accounts/summary` pour le recapitulatif periodique des soldes par compte avec graphique d'evolution.
- Le widget `AccountsSummaryWidget` sur le dashboard principal restera un resume compact avec un lien "Voir details".
- Ajouter une route dans `App.tsx`.

**C. Routes de connexion : redirection si deja connecte**
- Dans `Login.tsx`, `Signup.tsx`, `HeroSection.tsx` et `PricingSection.tsx` : verifier si `user` existe.
  - Si connecte : le bouton "Commencer gratuitement" et les liens vers `/signup` redirigent vers `/dashboard`.
  - `Login` et `Signup` redirigent automatiquement vers `/dashboard` si deja connecte.

| Fichier | Action |
|---------|--------|
| `src/hooks/useProfile.tsx` | Verifier formatage `fmt()` |
| `src/pages/dashboard/AccountsPage.tsx` | Ajouter vue recapitulative |
| `src/App.tsx` | Ajouter route sous-page comptes |
| `src/pages/Login.tsx` | Redirection si connecte |
| `src/pages/Signup.tsx` | Redirection si connecte |
| `src/components/landing/HeroSection.tsx` | Lien conditionnel `/dashboard` si connecte |
| `src/components/landing/PricingSection.tsx` | Lien conditionnel `/dashboard` si connecte |
| `src/i18n/dashTranslations.ts` | Ajouter cles traduction |

---

### Resume des fichiers impactes

| # | Fichier | Axes |
|---|---------|------|
| 1 | `supabase/functions/ai-savings-simulate/index.ts` | I |
| 2 | `src/pages/dashboard/TransactionsPage.tsx` | II |
| 3 | `src/components/landing/PricingSection.tsx` | III, IV-C |
| 4 | `src/pages/dashboard/PaymentPage.tsx` | III |
| 5 | `src/pages/Login.tsx` | IV-C |
| 6 | `src/pages/Signup.tsx` | IV-C |
| 7 | `src/components/landing/HeroSection.tsx` | IV-C |
| 8 | `src/pages/dashboard/AccountsPage.tsx` | IV-B |
| 9 | `src/App.tsx` | IV-B |
| 10 | `src/i18n/translations.ts` + `dashTranslations.ts` | III, IV |

