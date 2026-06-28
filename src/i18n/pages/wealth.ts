import { Building2, Car, TrendingUp, Wallet, Gem, Package } from 'lucide-react';

export const WEALTH_ASSET_TYPES = [
  { value: 'real_estate', label_fr: 'Immobilier', label_en: 'Real Estate', icon: '🏠', lucide: Building2, color: 'hsl(var(--primary))' },
  { value: 'vehicle', label_fr: 'Véhicule', label_en: 'Vehicle', icon: '🚗', lucide: Car, color: 'hsl(var(--secondary))' },
  { value: 'financial', label_fr: 'Investissement financier', label_en: 'Financial Investment', icon: '📈', lucide: TrendingUp, color: 'hsl(var(--accent))' },
  { value: 'savings', label_fr: 'Épargne & Comptes', label_en: 'Savings & Accounts', icon: '💰', lucide: Wallet, color: 'hsl(var(--chart-4, 280 65% 60%))' },
  { value: 'jewelry', label_fr: 'Bijoux & Objets de valeur', label_en: 'Jewelry & Valuables', icon: '💎', lucide: Gem, color: 'hsl(var(--chart-5, 340 75% 55%))' },
  { value: 'other', label_fr: 'Autre', label_en: 'Other', icon: '📦', lucide: Package, color: 'hsl(var(--muted-foreground))' },
];

export const WEALTH_CATEGORIES: Record<string, { label_fr: string; label_en: string }[]> = {
  real_estate: [
    { label_fr: 'Terrain', label_en: 'Land' },
    { label_fr: 'Maison', label_en: 'House' },
    { label_fr: 'Appartement', label_en: 'Apartment' },
    { label_fr: 'Immeuble', label_en: 'Building' },
    { label_fr: 'Local commercial', label_en: 'Commercial Space' },
  ],
  vehicle: [
    { label_fr: 'Voiture', label_en: 'Car' },
    { label_fr: 'Moto', label_en: 'Motorcycle' },
    { label_fr: 'Camion', label_en: 'Truck' },
  ],
  financial: [
    { label_fr: 'Actions', label_en: 'Stocks' },
    { label_fr: 'Obligations', label_en: 'Bonds' },
    { label_fr: 'Parts sociales', label_en: 'Shares' },
    { label_fr: 'Crypto', label_en: 'Crypto' },
    { label_fr: 'Assurance vie', label_en: 'Life Insurance' },
    { label_fr: 'Fonds commun', label_en: 'Mutual Fund' },
  ],
  savings: [
    { label_fr: 'Compte épargne', label_en: 'Savings Account' },
    { label_fr: 'CAG', label_en: 'CAG' },
    { label_fr: 'Dépôt à terme', label_en: 'Term Deposit' },
  ],
  jewelry: [
    { label_fr: 'Or', label_en: 'Gold' },
    { label_fr: 'Bijoux', label_en: 'Jewelry' },
    { label_fr: "Œuvre d'art", label_en: 'Artwork' },
  ],
  other: [
    { label_fr: 'Équipement', label_en: 'Equipment' },
    { label_fr: 'Autre', label_en: 'Other' },
  ],
};

export const WEALTH_ICONS = ['🏠', '🏢', '🏗️', '🏘️', '🚗', '🏍️', '🚛', '📈', '💹', '🏦', '💰', '💎', '🪙', '📦', '🎨', '⚡', '🌍'];

export const wealthT = (isFr: boolean) => ({
  // Header / hero
  title: isFr ? 'Patrimoine' : 'Wealth',
  registeredAssets: isFr ? 'Actifs enregistrés' : 'Registered Assets',
  totalSavings: isFr ? 'Épargne totale' : 'Total Savings',
  valuations: isFr ? 'Valorisations' : 'Valuations',

  // Tabs
  overview: isFr ? "Vue d'ensemble" : 'Overview',
  myAssets: isFr ? 'Mes actifs' : 'My Assets',
  evolution: isFr ? 'Évolution' : 'Evolution',
  analysis: isFr ? 'Analyse' : 'Analysis',

  // Overview
  wealthDistribution: isFr ? 'Répartition du patrimoine' : 'Wealth Distribution',
  addAssetsToSeeDistribution: isFr ? 'Ajoutez des actifs pour voir la répartition' : 'Add assets to see distribution',
  topAssets: isFr ? 'Top actifs' : 'Top Assets',
  noAssetsYet: isFr ? 'Aucun actif enregistré' : 'No assets yet',
  savingsAutoAggregated: isFr ? 'Épargne (auto-agrégée)' : 'Savings (auto-aggregated)',

  // Assets list
  searchAsset: isFr ? 'Rechercher un actif...' : 'Search asset...',
  all: isFr ? 'Tous' : 'All',
  acquired: isFr ? 'Acquis le' : 'Acquired',
  revalue: isFr ? 'Valoriser' : 'Revalue',
  noAssetsFound: isFr ? 'Aucun actif trouvé' : 'No assets found',

  // Evolution
  netWorthEvolution: isFr ? 'Évolution de la valeur nette' : 'Net Worth Evolution',
  addValuationsToSeeEvolution: isFr ? "Ajoutez des valorisations pour voir l'évolution" : 'Add valuations to see evolution',
  history: isFr ? 'Historique' : 'History',
  noValuations: isFr ? 'Aucune valorisation' : 'No valuations',
  selectAssetForHistory: isFr ? 'Sélectionnez un actif pour voir son historique' : 'Select an asset to view its history',

  // Dialog: asset
  editAsset: isFr ? "Modifier l'actif" : 'Edit Asset',
  addAsset: isFr ? 'Ajouter un actif' : 'Add Asset',
  fillAssetInfo: isFr ? 'Renseignez les informations de votre bien' : 'Enter your asset details',
  identification: isFr ? 'Identification' : 'Identification',
  assetName: isFr ? "Nom de l'actif" : 'Asset Name',
  assetNamePlaceholder: isFr ? 'Ex: Terrain Bingerville' : 'E.g: Downtown Apartment',
  assetType: isFr ? "Type d'actif" : 'Asset Type',
  category: isFr ? 'Catégorie' : 'Category',
  choose: isFr ? 'Choisir...' : 'Choose...',
  valuation: isFr ? 'Valorisation' : 'Valuation',
  currentValue: isFr ? 'Valeur actuelle' : 'Current Value',
  acquisitionCost: isFr ? "Coût d'acquisition" : 'Acquisition Cost',
  optional: isFr ? 'optionnel' : 'optional',
  additionalDetails: isFr ? 'Détails complémentaires' : 'Additional Details',
  acquisitionDate: isFr ? "Date d'acquisition" : 'Acquisition Date',
  location: isFr ? 'Localisation' : 'Location',
  locationPlaceholder: isFr ? 'Ex: Abidjan, Cocody' : 'E.g: Paris, 16th',
  additionalDetailsPlaceholder: isFr ? 'Détails supplémentaires...' : 'Additional details...',

  // Dialog: valuation
  newValuation: isFr ? 'Nouvelle valorisation' : 'New Valuation',
  updateAssetValue: isFr ? 'Mettez à jour la valeur de cet actif' : "Update this asset's value",
  newValue: isFr ? 'Nouvelle valeur' : 'New Value',
  reasonForRevaluation: isFr ? 'Raison de la réévaluation...' : 'Reason for revaluation...',

  // Delete
  deleteAsset: isFr ? 'Supprimer cet actif' : 'Delete Asset',
  irreversible: isFr ? 'Cette action est irréversible.' : 'This action cannot be undone.',

  // Validation
  nameRequired: isFr ? 'Le nom est requis' : 'Name is required',
  valueMustBePositive: isFr ? 'La valeur doit être supérieure à 0' : 'Value must be greater than 0',
  costNotNegative: isFr ? 'Le coût ne peut pas être négatif' : 'Cost cannot be negative',
  dateNotInFuture: isFr ? 'La date ne peut pas être dans le futur' : 'Date cannot be in the future',

  // Toasts / misc
  initialValue: isFr ? 'Valeur initiale' : 'Initial value',
  valuationRecorded: isFr ? 'Valorisation enregistrée' : 'Valuation recorded',
  aiSuggestion: isFr ? 'Suggestion IA' : 'AI suggestion',
  aiSuggests: (v: string) => isFr ? `IA suggère : ${v}` : `AI suggests: ${v}`,
});
