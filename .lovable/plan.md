

# BudgetPlan - Application de Planification Budgétaire

Application de gestion financière personnelle et familiale avec modèle freemium, disponible en français et anglais.

## 🎨 Design & Style
- Interface colorée et conviviale avec des dégradés chaleureux (bleu/vert/violet)
- Design adapté mobile-first, accessible à tous
- Icônes expressives et animations fluides

## 📱 Pages & Navigation

### Pages publiques
- **Landing page** — Présentation de l'app, tarifs, témoignages, CTA d'inscription
- **Page de connexion / inscription** — Email + mot de passe, avec choix de langue
- **Page de tarification** — Comparaison Gratuit vs Premium

### Pages de l'application (après connexion)

1. **Tableau de bord** — Vue d'ensemble : solde, dépenses du mois, graphiques de tendance, alertes budget
2. **Transactions** — Ajout/modification de revenus et dépenses, catégorisation automatique, filtres par date/catégorie
3. **Budgets** — Création de budgets par catégorie (alimentation, transport, loisirs, etc.), barres de progression, alertes de dépassement
4. **Prévisions** — Graphiques de projection des finances futures basés sur l'historique, scénarios (optimiste/pessimiste)
5. **Famille** — Gestion multi-membres (Premium), invitation par email, budgets partagés, suivi par membre
6. **Objectifs d'épargne** — Définir des objectifs (vacances, achat, fonds d'urgence), suivi visuel de la progression
7. **Rapports** — Rapports mensuels/annuels détaillés, export PDF, comparaisons mois par mois
8. **Paramètres** — Profil, choix de devise, langue (FR/EN), gestion de l'abonnement, notifications

## 💰 Modèle Freemium + Premium

### Gratuit
- Suivi des revenus/dépenses (max 50 transactions/mois)
- 5 catégories de budget
- Tableau de bord basique
- 1 utilisateur

### Premium (abonnement mensuel avec période d'essai de 14 jours)
- Transactions illimitées
- Catégories illimitées
- Prévisions financières
- Gestion familiale multi-membres
- Objectifs d'épargne
- Rapports détaillés et exports
- Support prioritaire

## 🌍 Internationalisation
- Interface entièrement traduite en français et anglais
- Changement de langue dans les paramètres et à l'inscription
- Formats de date et devise adaptés selon la locale

## 🔧 Backend (Lovable Cloud / Supabase)
- Authentification (email/mot de passe)
- Base de données : utilisateurs, transactions, budgets, catégories, objectifs, familles
- Paiement via Stripe (abonnement mensuel + période d'essai)
- Sécurité : Row-Level Security, rôles utilisateurs

## 📲 Distribution
- PWA installable immédiatement depuis le navigateur
- Configuration Capacitor pour publication future sur Play Store et App Store

## Étapes d'implémentation
1. Landing page + système d'authentification + internationalisation (FR/EN)
2. Tableau de bord + gestion des transactions et catégories
3. Module budgets par catégorie avec alertes
4. Prévisions financières avec graphiques
5. Gestion familiale multi-membres
6. Objectifs d'épargne et rapports
7. Intégration Stripe (abonnement Premium + essai gratuit)
8. Configuration PWA + Capacitor

