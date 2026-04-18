

## Refonte Sidebar + Navigation ERP intelligente

### Vision
Transformer Budget Planner en une interface **ERP financier premium** avec navigation hiérarchique intelligente, sidebar glassmorphism Coach Financier, et UX contextuelle (pinned, récents, raccourcis, recherche universelle).

---

### A. Refonte visuelle du Sidebar (forme)

**`AppSidebar.tsx` — refonte complète**
- **Surface glass premium** : `bg-sidebar/70 backdrop-blur-2xl`, bordure droite gradient subtil, blob décoratif en haut
- **Header logo** : badge gradient primary→accent avec glow, nom "Budget Planner" en Space Grotesk + sous-titre "ERP Financier" (locale-aware)
- **Search bar** : redesign en "command palette inline" avec icône, placeholder, kbd ⌘K, glow primary au hover
- **Items de menu** :
  - Pill `rounded-xl` h-10, padding harmonisé
  - Icônes dans un mini-conteneur `bg-primary/10` quand actif
  - Indicateur actif : barre verticale gradient à gauche (4px) + fond `bg-sidebar-accent` + glow
  - Hover : translation x +2px + fond `bg-sidebar-accent/40`
  - Badges contextuels (compteurs : nb transactions du jour, alertes, etc.)
- **Group labels** : uppercase tracking-widest avec petit séparateur ligne dégradée
- **Footer** : 
  - Theme toggle redesigné en segment premium glass
  - Profile card avec ring gradient animé, plan badge avec sparkle, mini-stats (jours streak + score santé)

---

### B. Navigation ERP intelligente (fond)

**1. Hiérarchie ERP repensée — 6 modules + sous-modules**

```text
🏠  Tableau de bord
💸  Opérations
    ├─ Transactions
    ├─ Récurrences
    ├─ Reçus
    └─ Saisie rapide ⚡
🏦  Trésorerie
    ├─ Comptes
    ├─ Patrimoine
    └─ Dettes
🎯  Pilotage
    ├─ Budgets
    ├─ Épargne
    └─ Prévisions
📊  Analyse
    ├─ Rapports
    ├─ Catégories
    └─ Coach IA
👥  Organisation
    ├─ Famille
    ├─ Abonnement
    ├─ Paramètres
    └─ Guide
🛡️  Admin (admin only)
```

Chaque groupe est **collapsible** (Radix Collapsible), reste ouvert si la route active appartient au groupe.

**2. Section "Épinglés" en haut**
- L'utilisateur peut épingler jusqu'à 4 modules favoris (stockés dans `localStorage` clé `bp_pinned_nav`)
- Bouton ⭐ apparaît au hover sur chaque item
- Section "Épinglés" rendue avant les groupes si non-vide

**3. Section "Récents"**
- Tracker simple via `useEffect` sur `location.pathname` qui pousse dans un Set max 3 (localStorage `bp_recent_nav`)
- Affichée juste sous Épinglés, masquée si vide

**4. Badges intelligents**
- Hook léger `useNavBadges` qui interroge en parallèle :
  - Transactions : compte du jour
  - Budgets : nb dépassés
  - Dettes : nb en retard
  - Notifications : nb non-lues (déjà existant via NotificationBell)
- Affichés en `Badge` rouge/amber sur l'item

**5. Quick switcher global**
- Garde Cmd+K (existant `GlobalSearchCommand`) mais ajoute section "Aller à…" listant tous les modules avec icônes
- Raccourcis clavier `g + t` (transactions), `g + b` (budgets), `g + s` (savings) — listener global dans `DashboardLayout`

**6. Breadcrumb enrichi (top bar)**
- Le `Breadcrumb` actuel reçoit le **groupe parent** (ex: `Pilotage > Budgets`) pour cohérence ERP

---

### C. Fichiers à créer / modifier

**Modifié :**
- `src/components/dashboard/AppSidebar.tsx` — refonte complète (forme + groupes ERP + pinned + récents + badges)
- `src/components/dashboard/DashboardLayout.tsx` — listener `g+x` shortcuts, passer `groupLabel` au Breadcrumb
- `src/components/dashboard/Breadcrumb.tsx` — accepter et afficher le groupe parent
- `src/components/dashboard/GlobalSearchCommand.tsx` — section "Aller à…" avec tous les modules
- `src/i18n/dashTranslations.ts` — ajouter clés `pinned`, `recent`, `operations`, `treasury`, `piloting`, `analysis`, `organization`, `erpSubtitle`

**Créé :**
- `src/hooks/useNavBadges.tsx` — TanStack Query parallèle pour les compteurs
- `src/hooks/usePinnedNav.tsx` — gestion localStorage épinglés + récents
- `mem://ux/erp-navigation-system.md` — documenter la nouvelle hiérarchie + raccourcis

---

### D. Hors-scope
- Pas de refonte de la `MobileBottomNav` (reste à 5 items principaux)
- Pas de drag-and-drop pour réorganiser les épinglés (clic ⭐ suffit)
- Pas de personnalisation de la hiérarchie par user (statique, mais épinglés couvrent le besoin)

---

### E. Mémoire
- Mettre à jour `mem://ux/navigation-behavior/interactive-ui` avec la nouvelle hiérarchie ERP
- Créer `mem://ux/erp-navigation-system` (groupes, épinglés, badges, raccourcis g+x)

