export const ACCOUNT_TYPE_LABELS: Record<'fr' | 'en', Record<string, string>> = {
  fr: { bank: 'Banque', mobile_money: 'Mobile Money', cash: 'Espèces', card: 'Carte', savings: 'Épargne' },
  en: { bank: 'Bank', mobile_money: 'Mobile Money', cash: 'Cash', card: 'Card', savings: 'Savings' },
};

export const ACCOUNT_TYPE_ICONS: Record<string, string> = {
  bank: '🏦', mobile_money: '📱', cash: '💵', card: '💳', savings: '🐖',
};

export const accountsT = (isFr: boolean) => ({
  // Header & toggles
  periodStats: isFr ? 'Stats période' : 'Period stats',
  backToAllAccounts: isFr ? 'Retour à tous les comptes' : 'Back to all accounts',
  archived: isFr ? 'Archivés' : 'Archived',

  // Filters & sort
  searchAccounts: isFr ? 'Rechercher un compte...' : 'Search accounts...',
  sortName: isFr ? 'Nom' : 'Name',
  sortBalance: isFr ? 'Solde' : 'Balance',
  sortDiscrepancy: isFr ? 'Écart' : 'Discrepancy',
  all: isFr ? 'Tous' : 'All',
  withDiscrepancy: isFr ? 'Avec écart' : 'With discrepancy',
  noAccountsOfType: isFr ? 'Aucun compte de ce type' : 'No accounts of this type',

  // Validation & toasts
  balanceCannotBeNegative: isFr ? 'Le solde ne peut pas être négatif' : 'Balance cannot be negative',
  unarchived: isFr ? 'Désarchivé' : 'Unarchived',
  archivedToast: isFr ? 'Archivé' : 'Archived',
  cannotDeleteLinked: (count: number, names: string) => isFr
    ? `Impossible : compte lié à ${count} objectif(s) d'épargne actif(s) (${names})`
    : `Cannot delete: linked to ${count} active savings goal(s) (${names})`,

  // Cash count report
  cashCountReport: isFr ? "Procès-Verbal d'Espèces" : 'Cash Count Report',
  denomination: isFr ? 'Coupure' : 'Denomination',
  quantity: isFr ? 'Quantité' : 'Quantity',
  subtotal: isFr ? 'Sous-total' : 'Subtotal',
  print: isFr ? 'Imprimer' : 'Print',
});
