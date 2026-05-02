---
name: Paystack currency fallback
description: PaymentPage and OnboardingPage convert non-African currencies (EUR/GBP/CAD/CHF) to XOF via resolvePaystackPrice() before calling paystack-checkout, since the merchant account only has channels active for XOF/XAF/NGN/GHS/KES/ZAR/USD
type: feature
---
Le compte Paystack africain ne supporte pas les devises EUR/GBP/CAD/CHF — toute tentative de paiement renvoie l'erreur **"No active channel to process transaction. Please contact merchant"**.

Helper : `src/lib/paystackCurrency.ts`
- `PAYSTACK_SUPPORTED_CURRENCIES` = liste blanche
- `resolvePaystackPrice(amount, currency)` retourne `{ amount, currency, converted, originalCurrency, originalAmount }` ; convertit en XOF avec taux fixes si nécessaire (XOF est pegged à EUR à 655.957)
- `formatXofConversionMessage(res, isFr)` produit un toast d'info bilingue

À utiliser **systématiquement** avant tout appel à `paystack-checkout` (déjà intégré dans `PaymentPage.handleSubscribe` et `OnboardingPage.handlePayment`). Les `payment_receipts` doivent stocker la devise/montant réellement débitée (XOF), pas la devise d'affichage.
