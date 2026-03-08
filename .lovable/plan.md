

# Plan mis à jour : Comptes, Onboarding, Épargne, Prévisions IA + Admin pricing

## Ajout au plan : Administration des prix & adaptation géolocalisée

### 5. Admin — Paramétrage des prix des plans

**Table `subscription_plans`** (gérée par l'admin) :
```sql
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,              -- 'free', 'premium'
  base_price numeric NOT NULL,     -- prix de référence en EUR
  currency_prices jsonb NOT NULL DEFAULT '{}', -- {"XOF": 3000, "USD": 5, "EUR": 4.99, ...}
  trial_days int NOT NULL DEFAULT 0,
  features jsonb NOT NULL DEFAULT '[]',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- RLS : lecture publique (tous les users voient les plans), écriture admin seulement
```

**Table `user_roles`** (sécurité admin) :
```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
-- + fonction has_role() SECURITY DEFINER
-- RLS sur subscription_plans : INSERT/UPDATE/DELETE réservés aux admins via has_role()
```

**Page Admin (`/dashboard/admin/pricing`)** :
- Accessible uniquement si l'utilisateur a le rôle `admin`
- Interface CRUD pour modifier les plans : nom, prix par devise (EUR, USD, XOF, XAF, GBP, CAD, CHF)
- Chaque plan a un prix par devise stocké dans `currency_prices` (jsonb)

### Détection automatique de la devise réelle (géolocalisation)

- Appel à une API de géolocalisation gratuite (ex: `https://ipapi.co/json/`) côté client au chargement de l'app
- On récupère le `currency` du pays détecté (pas la devise paramétrée par l'utilisateur)
- Ce `detected_currency` est stocké en mémoire (state/context) et utilisé pour afficher les prix des plans
- Logique de fallback : si la devise détectée n'a pas de prix configuré → afficher le prix en EUR avec mention de conversion

### Affichage des prix dans l'Onboarding et la page Paiement

- Les prix affichés sont ceux correspondant à la devise géolocalisée
- Exemple : un utilisateur au Sénégal voit `3 000 XOF/mois`, un utilisateur en France voit `4,99 €/mois`
- Le montant envoyé à PayDunya est toujours en XOF (conversion côté edge function si nécessaire)

---

## Récapitulatif complet du plan (7 blocs)

1. **Migration DB** — Tables `payment_accounts`, `subscription_plans`, `user_roles` + colonnes `account_id` sur transactions/savings + `onboarding_completed` sur profiles + fonction `has_role()`
2. **Page Comptes** — CRUD des moyens de paiement, calcul solde théorique vs réel, écart
3. **Transactions liées aux comptes** — Sélecteur de compte dans le formulaire transaction
4. **Épargne liée aux comptes** — Sélecteur de compte, suivi progression théorique/réelle
5. **Onboarding** — Stepper : bienvenue → plan (prix géolocalisés) → préférences → comptes → terminé
6. **Admin pricing** — Page admin pour CRUD des plans/prix par devise, rôle admin, détection devise par IP
7. **Prévisions IA** — Edge function `ai-forecast` avec Gemini Flash, analyse existant + prévisions détaillées/globales

