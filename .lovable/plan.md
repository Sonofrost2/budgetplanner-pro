# Audit Métier — Budget Planner

## 1. Transactions (cœur du système)

**Process actuel** : création → validation inline → vérification dépassement budget → insertion Supabase → invalidation cache croisée (comptes, budgets, charts). Pagination server-side. Tri, filtres, recherche débounced.


| #   | Problème                                                                                                                                                                                                                                               | Impact                                                                                                 | Priorité |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | -------- |
| T1  | **Pas de recalcul solde compte après save/delete** — `recalculate_account_balance` est un **no-op** (fonction vide). Le `real_balance` ne se met jamais à jour automatiquement **(c'est l'utilisateur qui doit mettre à jour le solde réel donc N/A)** | Écart croissant entre solde affiché et réalité**c'est l'utilisateur qui doit le faire mannuellement** | N/A      |
| T2  | **Budget overspend check incomplet** — Ne vérifie que `budgets[0]`. Si plusieurs budgets partagent la même catégorie, les autres sont ignorés                                                                                                          | Faux sentiment de sécurité                                                                             | Haute    |
| T3  | **Bulk delete sans recalcul compte** — `handleBulkDelete` supprime les transactions mais ne recalcule pas les soldes (contrairement à `handleBulkModify` qui le fait)                                                                                  | Soldes incohérents                                                                                     | Haute    |
| T4  | **Duplication de la logique AI suggest** — Handler identique dans `TransactionsPage.tsx` ET `TransactionForm.tsx`                                                                                                                                      | Maintenance double                                                                                     | Moyenne  |
| T5  | **Pas d'annulation de transfert** — 2 transactions liées créées, aucun moyen d'inverser un transfert erroné                                                                                                                                            | UX frustrant                                                                                           | Moyenne  |
| T6  | **Pas de validation de date future** — Aucun avertissement pour 2050. Pas de date minimum                                                                                                                                                              | Données aberrantes                                                                                     | Basse    |


---

## 2. Comptes

**Process actuel** : création (type/icône/solde initial) → solde théorique calculé client-side (`opening_balance + income - expense`) → solde réel manuel (PV d'espèces).


| #   | Problème                                                                                                                                                         | Impact               | Priorité |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | -------- |
| A1  | **Suppression compte avec transactions liées** — Aucun avertissement. Transactions deviennent orphelines (`account_id = NULL`). Perte de traçabilité silencieuse | Perte de données     | Haute    |
| A2  | **Suppression compte lié à objectif épargne** — L'objectif perd son `account_id` silencieusement, les recalculs cassent                                          | Épargne corrompue    | Haute    |
| A3  | **Pas de fusion de comptes** — Fréquent avec les comptes auto-créés par le module épargne, doublons qui s'accumulent                                             | Pollution de données | Moyenne  |


---

## 3. Budgets

**Process actuel** : création → liaison catégorie obligatoire → calcul spending via RPC → annualisation pour budgets non-mensuels → alerte au seuil.


| #   | Problème                                                                                                                          | Impact                   | Priorité |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | -------- |
| B1  | **Spending query N+1** — Chaque budget déclenche un RPC individuel. 20 budgets = 20 requêtes parallèles + 20 pour l'annuel        | Performance              | Moyenne  |
| B2  | **Pas de budget transversal** — Budget DOIT être lié à une catégorie. Impossible de faire un budget "Provisions" multi-catégories | Limitation fonctionnelle | Moyenne  |
| B3  | `**as any` omniprésent** — `budget_type`, `control_type` ne sont pas dans les types Supabase générés                              | Risque runtime           | Moyenne  |


B4       Prévoir aussi le cas où le budget est atteint pour la période donnée et proposer à l'utilisateur de reconduire le budget pour la même période prochaine (cas des budgets ponctuels ou des prévisions à court terme)

## 4. Épargne

**Process actuel** : création objectif → auto-création compte → versements via transfert atomique → recalcul depuis transactions (bouton manuel) → simulation IA → archivage/réinvestissement.


| #   | Problème                                                                                                                                                                                           | Impact                 | Priorité     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------ |
| S1  | **Capitalisation d'intérêts sans garde-fou temporel** — Le bouton peut être cliqué 10 fois le même jour, chaque clic crée une transaction d'intérêts. Aucun tracking de la dernière capitalisation | Double/triple comptage | **Critique** |
| S2  | **Réinvestissement archive immédiatement** — `handleReinvest` appelle `handleArchive` **avant** que l'utilisateur valide le formulaire. S'il annule → l'ancien objectif est déjà archivé           | Archivage prématuré    | Haute        |
| S3  | **Versement sans validation du solde source** — On peut verser 10M FCFA même si le compte source a 0                                                                                               | Données aberrantes     | Haute        |
| S4  | **Formulaire quasi sans validation** — Seul check : `name.trim()` et `target_amount > 0`. Pas de contrôle sur `contribution_day` (1-31), `interest_rate` (0-100), dates cohérentes                 | Données invalides      | Haute        |
| S5  | **Sync basé sur patterns textuels** — Cherche "épargne", "cag", "🎯" dans les descriptions. Fragile et faux positifs                                                                               | Sync incorrect         | Moyenne      |


---

## 5. Dettes

**Process actuel** : création → paiements partiels (update `paid_amount`) → progression → plan IA.


| #   | Problème                                                                                                                                                                                           | Impact                           | Priorité     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------ |
| D1  | **Paiement de dette NON lié aux transactions** — `handlePay` met juste à jour `paid_amount` directement. Aucune transaction expense créée. Le remboursement est invisible dans les flux financiers | **Incohérence comptable totale** | **Critique** |
| D2  | **Pas de lien compte** — La dette n'a pas de `account_id`. On ne sait pas d'où vient l'argent du remboursement                                                                                     | Traçabilité nulle                | Haute        |
| D3  | **Pas d'alerte d'échéance** — `check-alerts` ne vérifie pas les `due_date` proches des dettes                                                                                                      | Retards silencieux               | Haute        |
| D4  | **Bulk delete en boucle séquentielle** — `for...of` avec `await` au lieu d'un `.in('id', ids)`                                                                                                     | Performance + échec partiel      | Moyenne      |


---

## 6. Récurrences


| #   | Problème                                                                                                               | Impact                  | Priorité |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------- | -------- |
| R1  | **Pas de vérification budget** — Les récurrences créent des transactions sans vérifier si ça dépasse le budget associé | Dépassements silencieux | Haute    |
| R2  | **Détection IA sans "tout accepter"** — L'utilisateur doit valider chaque pattern un par un                            | UX fastidieux           | Moyenne  |


---

## 7. Liens intermodules — Cartographie

```text
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│ Transactions │────▶│   Comptes    │◀────│   Épargne    │
│              │     │              │     │              │
│ • create     │     │ • théorique  │     │ • versements │
│ • transfer   │     │ • réel (PV)  │     │ • intérêts   │
│ • bulk ops   │     │ • types      │     │ • archivage  │
└──────┬───────┘     └──────┬───────┘     └──────────────┘
       │                    │
       ▼                    │
┌──────────────┐            │         ┌──────────────┐
│   Budgets    │            │         │   Dettes     │
│              │            │         │              │
│ • spending   │            │         │ • paiements  │
│ • alertes    │     ❌ Non lié       │ • plan IA    │
│ • projection │            │         │              │
└──────────────┘            │         └──────────────┘
       ❌                   ❌               ❌
  Récurrences           Comptes           Transactions
  non vérifiées         non liés          non créées
```

**Liaisons manquantes critiques :**

- Dettes → Transactions (paiements invisibles)
- Dettes → Comptes (pas de traçabilité source)
- Récurrences → Budgets (pas de vérification dépassement)
- Comptes → Épargne (suppression sans protection)

---

## 8. Formulaires & Validation


| Module       | État actuel                | Manques                                                              |
| ------------ | -------------------------- | -------------------------------------------------------------------- |
| Transactions | Validation inline manuelle | Pas de Zod. Pas de date future. Pas de montant max contextuel        |
| Budgets      | Validation inline          | Pas de Zod. `expected_day` non borné                                 |
| Épargne      | **Quasi absente**          | Pas de Zod. Pas de validation interest_rate, contribution_day, dates |
| Dettes       | Validation inline          | Pas de Zod. Pas de validation due_date futur                         |
| Comptes      | Name non vide              | Pas de doublon de nom                                                |


---

## 9. Calculs à risque


| Calcul                  | Risque                                                                |
| ----------------------- | --------------------------------------------------------------------- |
| Capitalisation intérêts | **Critique** — Peut être exécuté N fois sans contrôle temporel        |
| Budget overspend        | **Élevé** — Ne vérifie qu'un seul budget par catégorie                |
| Solde réel compte       | **Élevé** — `recalculate_account_balance` est vide, jamais mis à jour |
| Épargne current_amount  | **Moyen** — Recalcul manuel par bouton, pas automatique               |


---

## 10. Plan d'action recommandé

### Phase A — Corrections critiques (bugs métier)

1. **Lier paiements dettes aux transactions** — Créer une expense + update `paid_amount` atomiquement, avec choix du compte source
2. **Garde-fou capitalisation intérêts** — Tracker `last_capitalized_at` sur `savings_goals`, bloquer si période non écoulée
3. **Corriger le réinvestissement** — Archiver seulement APRÈS validation du nouveau formulaire
4. **Vérifier TOUS les budgets d'une catégorie** (pas seulement `[0]`)
5. **Recalculer soldes après bulk delete transactions**

### Phase B — Intégrité intermodule

6. **Ajouter `account_id` aux dettes** (migration DB) pour tracer les remboursements
7. **Empêcher suppression comptes liés** à des objectifs d'épargne actifs
8. **Alertes d'échéance dette** dans `check-alerts`
9. **Vérification budget avant exécution récurrence** dans `process-recurring`

### Phase C — Validation des formulaires

10. **Validation Zod** sur les 4 formulaires principaux
11. **Plages** : contribution_day (1-31), interest_rate (0-100), dates cohérentes
12. **Avertissement date future** pour les transactions

### Phase D — Optimisation

13. **Budget spending batch** — Une seule query pour tous les budgets
14. **Suppression du code AI dupliqué** dans TransactionsPage
15. **Bulk delete dettes** via `.in()` au lieu de boucle