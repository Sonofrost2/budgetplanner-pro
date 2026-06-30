# Budget Planner Pro — Store Listing Kit

> Tout ce qu'il faut pour soumettre l'app sur Google Play et Apple App Store.
> Icône maître : `/mnt/documents/store-assets/icon-1024.png` (1024×1024, PNG, sans transparence).

---

## 1. Identité de l'app

| Champ | Valeur |
|---|---|
| App ID (bundle) | `app.lovable.2f84ea3c29cc4df2ab1dda5d2ef488ee` |
| Nom commercial | Budget Planner Pro |
| Catégorie principale | Finance |
| Catégorie secondaire | Productivité |
| Classification d'âge | 4+ (iOS) · PEGI 3 (Android) — pas de contenu sensible |
| Site officiel | https://budget-planner-pro.eurekaci.dev |
| Politique de confidentialité | https://budget-planner-pro.eurekaci.dev/legal/privacy |
| Politique de cookies | https://budget-planner-pro.eurekaci.dev/legal/cookies |
| Suppression de compte (exigée Google Play) | https://budget-planner-pro.eurekaci.dev/account-deletion |
| Support | comptabilite@eurekaci.dev |

---

## 2. Titre & sous-titre (ASO)

### Français
- **Titre (30 car. max)** : `Budget Planner Pro`
- **Sous-titre (30 car. max)** : `Budget, épargne & MoMo`
- **Mots-clés ASO (100 car. max, App Store iOS)** :
  `budget,epargne,mobile money,wave,orange money,momo,finance,famille,depense,argent,cfa,xof`

### English
- **Title (30 char.)** : `Budget Planner Pro`
- **Subtitle (30 char.)** : `Budget, savings & MoMo`
- **Keywords ASO (100 char.)** :
  `budget,savings,mobile money,wave,orange money,momo,finance,family,expense,money,cfa,xof`

---

## 3. Description courte (Google Play, 80 caractères)

- **FR** : `Reprenez le contrôle de votre budget, votre épargne et vos comptes Mobile Money.`
- **EN** : `Take control of your budget, savings and Mobile Money accounts.`

---

## 4. Description longue

### FR (4000 car. max)
```
Budget Planner Pro est l'application de gestion financière conçue pour l'Afrique de l'Ouest.
Centralisez en quelques minutes votre banque (SGCI, Ecobank, BoA…), vos portefeuilles Mobile Money
(Wave, Orange Money, MTN MoMo, Moov Money) et vos espèces dans une vue unique, claire et sécurisée.

CE QUE VOUS POUVEZ FAIRE
• Suivre toutes vos transactions, catégorisées automatiquement (80+ catégories localisées)
• Créer des budgets mensuels, trimestriels ou annuels — l'app annualise les charges variables
• Définir des objectifs d'épargne avec montant cible et date butoir
• Gérer vos dettes (méthode avalanche ou boule de neige) et vos crédits
• Suivre votre patrimoine net (actifs - passifs) sur 5 ans
• Partager un budget familial avec votre conjoint(e) ou vos enfants
• Exporter vos données en CSV ou PDF à tout moment
• Recevoir un coach financier IA personnalisé

SÉCURITÉ DE NIVEAU BANCAIRE
• Chiffrement TLS 1.3 en transit et au repos
• Authentification à 2 facteurs disponible
• Aucune donnée vendue ni partagée à des fins commerciales
• Conforme RGPD — suppression de compte en 1 clic

TARIFS TRANSPARENTS
• Gratuit à vie : 15 transactions/mois, 3 comptes, 5 budgets
• Pro : 8 990 FCFA/mois — illimité, IA, multi-devises
• Premium : pour les familles et les conseillers financiers

PAIEMENTS LOCAUX
Réglez par Mobile Money (Wave, Orange, MTN, Moov), carte Visa/Mastercard, ou virement bancaire,
via notre partenaire Paystack — sécurité PCI-DSS niveau 1.

Téléchargez Budget Planner Pro et reprenez le contrôle de votre argent dès aujourd'hui.
```

### EN (4000 char. max)
```
Budget Planner Pro is the financial management app built for West Africa.
In minutes, centralize your bank (SGCI, Ecobank, BoA…), your Mobile Money wallets
(Wave, Orange Money, MTN MoMo, Moov Money) and your cash in a single, clear, secure view.

WHAT YOU CAN DO
• Track every transaction with auto-categorization (80+ localized categories)
• Build monthly, quarterly or annual budgets — variable expenses are auto-annualized
• Set savings goals with target amount and deadline
• Manage debts (avalanche or snowball method) and credit lines
• Track your net worth (assets − liabilities) over 5 years
• Share a family budget with your spouse or children
• Export your data as CSV or PDF at any time
• Get a personalized AI financial coach

BANK-GRADE SECURITY
• TLS 1.3 encryption in transit and at rest
• Optional two-factor authentication
• No data sold or shared for commercial purposes
• GDPR-compliant — one-click account deletion

TRANSPARENT PRICING
• Free forever: 15 transactions/month, 3 accounts, 5 budgets
• Pro: 8,990 XOF/month — unlimited, AI, multi-currency
• Premium: for families and financial advisors

LOCAL PAYMENTS
Pay via Mobile Money (Wave, Orange, MTN, Moov), Visa/Mastercard, or bank transfer
through our partner Paystack — PCI-DSS Level 1 secure.

Download Budget Planner Pro and take back control of your money today.
```

---

## 5. Captures d'écran requises

| Store | Format | Quantité min | Quantité max |
|---|---|---|---|
| Google Play (phone) | 1080×1920 PNG ou JPEG | 2 | 8 |
| Google Play (tablet 7") | 1200×1920 | 1 | 8 |
| App Store (iPhone 6.7" — 13 Pro Max) | 1290×2796 | 3 | 10 |
| App Store (iPhone 6.5") | 1242×2688 | 3 | 10 |
| App Store (iPad 12.9") | 2048×2732 | 3 | 10 |

Écrans recommandés (mêmes 6 pour les deux stores) :
1. Dashboard — vue d'ensemble + KPIs
2. Transactions — liste + recherche
3. Budgets — barre de progression
4. Épargne — objectif avec courbe
5. Coach IA — message personnalisé
6. Patrimoine — courbe nette

→ Générer avec un screenshot tool (ex. AppMockup, Screenshot.rocks) à partir des captures réelles, puis ajouter un sous-titre court par écran.

---

## 6. Build APK & IPA — checklist locale

### Pré-requis
- Node 20+, Bun, JDK 17, Android Studio (Android), Xcode 15+ (iOS)
- Certificats signés : keystore Android (`.jks`) + Apple Developer Account

### Android
```bash
git pull
bun install
bun run build
npx cap sync android
# AAB pour Play Store (recommandé) :
cd android && ./gradlew bundleRelease
# APK pour test direct :
./gradlew assembleRelease
```
→ AAB : `android/app/build/outputs/bundle/release/app-release.aab`

### iOS
```bash
bun install
bun run build
npx cap sync ios
npx cap open ios
# Dans Xcode : Product → Archive → Distribute to App Store Connect
```

### Vérifications avant upload
- [ ] `capacitor.config.ts` : pas de `server.url` actif (production)
- [ ] `VITE_META_PIXEL_ID` / `VITE_TIKTOK_PIXEL_ID` configurés (ou laissés vides = no-op)
- [ ] Icônes générées via `npx capacitor-assets generate --iconBackgroundColor "#0F172A"`
- [ ] Tester l'APK sur un device physique avant upload
- [ ] Tester un paiement Paystack live de bout en bout

---

## 7. Mentions légales obligatoires

### Google Play Data Safety
- Données collectées : email, nom, identifiant utilisateur, données financières saisies par l'utilisateur, préférences app.
- Données partagées avec des tiers : aucune à des fins commerciales. Paystack reçoit les données strictement nécessaires au paiement (montant, devise, référence).
- Données chiffrées en transit : oui (TLS).
- Possibilité de demander la suppression : oui — voir `/account-deletion`.

### Apple App Privacy
- Catégorie : Financial Info, Contact Info (email, name), Identifiers (User ID), Usage Data (anonymized).
- Linked to user : Financial Info, Contact Info, Identifiers.
- Used for tracking : NO (sauf si l'utilisateur consent aux pixels marketing dans la bannière cookies).

---

## 8. Build secrets requis (production)

| Secret | Type | Usage |
|---|---|---|
| `PAYSTACK_SECRET_KEY` | runtime | Paiements + webhook signature |
| `RESEND_API_KEY` | runtime | Emails transactionnels |
| `CRON_SECRET` | runtime | Cron jobs |
| `SENTRY_DSN` / `SENTRY_EDGE_DSN` | runtime | Monitoring erreurs |
| `VITE_META_PIXEL_ID` | build | Pixel Meta (optionnel) |
| `VITE_TIKTOK_PIXEL_ID` | build | Pixel TikTok (optionnel) |