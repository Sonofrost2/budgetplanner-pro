// Comprehensive country list with ISO 3166-1 alpha-2 codes, dial codes, names FR/EN and emoji flags.
// Used by CountryPhoneInput for dial-code prefix and by libphonenumber-js for per-country validation.

export interface Country {
  code: string;        // ISO alpha-2, e.g. "CI"
  dial: string;        // e.g. "+225"
  flag: string;        // emoji
  nameFr: string;
  nameEn: string;
}

export const COUNTRIES: Country[] = [
  { code: 'CI', dial: '+225', flag: '🇨🇮', nameFr: "Côte d'Ivoire", nameEn: "Côte d'Ivoire" },
  { code: 'SN', dial: '+221', flag: '🇸🇳', nameFr: 'Sénégal', nameEn: 'Senegal' },
  { code: 'BJ', dial: '+229', flag: '🇧🇯', nameFr: 'Bénin', nameEn: 'Benin' },
  { code: 'BF', dial: '+226', flag: '🇧🇫', nameFr: 'Burkina Faso', nameEn: 'Burkina Faso' },
  { code: 'ML', dial: '+223', flag: '🇲🇱', nameFr: 'Mali', nameEn: 'Mali' },
  { code: 'TG', dial: '+228', flag: '🇹🇬', nameFr: 'Togo', nameEn: 'Togo' },
  { code: 'NE', dial: '+227', flag: '🇳🇪', nameFr: 'Niger', nameEn: 'Niger' },
  { code: 'GN', dial: '+224', flag: '🇬🇳', nameFr: 'Guinée', nameEn: 'Guinea' },
  { code: 'CM', dial: '+237', flag: '🇨🇲', nameFr: 'Cameroun', nameEn: 'Cameroon' },
  { code: 'GA', dial: '+241', flag: '🇬🇦', nameFr: 'Gabon', nameEn: 'Gabon' },
  { code: 'CG', dial: '+242', flag: '🇨🇬', nameFr: 'Congo', nameEn: 'Congo' },
  { code: 'CD', dial: '+243', flag: '🇨🇩', nameFr: 'RD Congo', nameEn: 'DR Congo' },
  { code: 'CF', dial: '+236', flag: '🇨🇫', nameFr: 'Centrafrique', nameEn: 'Central African Rep.' },
  { code: 'TD', dial: '+235', flag: '🇹🇩', nameFr: 'Tchad', nameEn: 'Chad' },
  { code: 'MR', dial: '+222', flag: '🇲🇷', nameFr: 'Mauritanie', nameEn: 'Mauritania' },
  { code: 'MA', dial: '+212', flag: '🇲🇦', nameFr: 'Maroc', nameEn: 'Morocco' },
  { code: 'DZ', dial: '+213', flag: '🇩🇿', nameFr: 'Algérie', nameEn: 'Algeria' },
  { code: 'TN', dial: '+216', flag: '🇹🇳', nameFr: 'Tunisie', nameEn: 'Tunisia' },
  { code: 'EG', dial: '+20',  flag: '🇪🇬', nameFr: 'Égypte', nameEn: 'Egypt' },
  { code: 'NG', dial: '+234', flag: '🇳🇬', nameFr: 'Nigéria', nameEn: 'Nigeria' },
  { code: 'GH', dial: '+233', flag: '🇬🇭', nameFr: 'Ghana', nameEn: 'Ghana' },
  { code: 'KE', dial: '+254', flag: '🇰🇪', nameFr: 'Kenya', nameEn: 'Kenya' },
  { code: 'ZA', dial: '+27',  flag: '🇿🇦', nameFr: 'Afrique du Sud', nameEn: 'South Africa' },
  { code: 'RW', dial: '+250', flag: '🇷🇼', nameFr: 'Rwanda', nameEn: 'Rwanda' },
  { code: 'UG', dial: '+256', flag: '🇺🇬', nameFr: 'Ouganda', nameEn: 'Uganda' },
  { code: 'TZ', dial: '+255', flag: '🇹🇿', nameFr: 'Tanzanie', nameEn: 'Tanzania' },
  { code: 'FR', dial: '+33',  flag: '🇫🇷', nameFr: 'France', nameEn: 'France' },
  { code: 'BE', dial: '+32',  flag: '🇧🇪', nameFr: 'Belgique', nameEn: 'Belgium' },
  { code: 'CH', dial: '+41',  flag: '🇨🇭', nameFr: 'Suisse', nameEn: 'Switzerland' },
  { code: 'LU', dial: '+352', flag: '🇱🇺', nameFr: 'Luxembourg', nameEn: 'Luxembourg' },
  { code: 'DE', dial: '+49',  flag: '🇩🇪', nameFr: 'Allemagne', nameEn: 'Germany' },
  { code: 'ES', dial: '+34',  flag: '🇪🇸', nameFr: 'Espagne', nameEn: 'Spain' },
  { code: 'IT', dial: '+39',  flag: '🇮🇹', nameFr: 'Italie', nameEn: 'Italy' },
  { code: 'PT', dial: '+351', flag: '🇵🇹', nameFr: 'Portugal', nameEn: 'Portugal' },
  { code: 'NL', dial: '+31',  flag: '🇳🇱', nameFr: 'Pays-Bas', nameEn: 'Netherlands' },
  { code: 'GB', dial: '+44',  flag: '🇬🇧', nameFr: 'Royaume-Uni', nameEn: 'United Kingdom' },
  { code: 'IE', dial: '+353', flag: '🇮🇪', nameFr: 'Irlande', nameEn: 'Ireland' },
  { code: 'US', dial: '+1',   flag: '🇺🇸', nameFr: 'États-Unis', nameEn: 'United States' },
  { code: 'CA', dial: '+1',   flag: '🇨🇦', nameFr: 'Canada', nameEn: 'Canada' },
  { code: 'MX', dial: '+52',  flag: '🇲🇽', nameFr: 'Mexique', nameEn: 'Mexico' },
  { code: 'BR', dial: '+55',  flag: '🇧🇷', nameFr: 'Brésil', nameEn: 'Brazil' },
  { code: 'AR', dial: '+54',  flag: '🇦🇷', nameFr: 'Argentine', nameEn: 'Argentina' },
  { code: 'CL', dial: '+56',  flag: '🇨🇱', nameFr: 'Chili', nameEn: 'Chile' },
  { code: 'CO', dial: '+57',  flag: '🇨🇴', nameFr: 'Colombie', nameEn: 'Colombia' },
  { code: 'PE', dial: '+51',  flag: '🇵🇪', nameFr: 'Pérou', nameEn: 'Peru' },
  { code: 'CN', dial: '+86',  flag: '🇨🇳', nameFr: 'Chine', nameEn: 'China' },
  { code: 'JP', dial: '+81',  flag: '🇯🇵', nameFr: 'Japon', nameEn: 'Japan' },
  { code: 'KR', dial: '+82',  flag: '🇰🇷', nameFr: 'Corée du Sud', nameEn: 'South Korea' },
  { code: 'IN', dial: '+91',  flag: '🇮🇳', nameFr: 'Inde', nameEn: 'India' },
  { code: 'PK', dial: '+92',  flag: '🇵🇰', nameFr: 'Pakistan', nameEn: 'Pakistan' },
  { code: 'BD', dial: '+880', flag: '🇧🇩', nameFr: 'Bangladesh', nameEn: 'Bangladesh' },
  { code: 'ID', dial: '+62',  flag: '🇮🇩', nameFr: 'Indonésie', nameEn: 'Indonesia' },
  { code: 'MY', dial: '+60',  flag: '🇲🇾', nameFr: 'Malaisie', nameEn: 'Malaysia' },
  { code: 'SG', dial: '+65',  flag: '🇸🇬', nameFr: 'Singapour', nameEn: 'Singapore' },
  { code: 'TH', dial: '+66',  flag: '🇹🇭', nameFr: 'Thaïlande', nameEn: 'Thailand' },
  { code: 'VN', dial: '+84',  flag: '🇻🇳', nameFr: 'Vietnam', nameEn: 'Vietnam' },
  { code: 'PH', dial: '+63',  flag: '🇵🇭', nameFr: 'Philippines', nameEn: 'Philippines' },
  { code: 'AE', dial: '+971', flag: '🇦🇪', nameFr: 'Émirats Arabes Unis', nameEn: 'UAE' },
  { code: 'SA', dial: '+966', flag: '🇸🇦', nameFr: 'Arabie Saoudite', nameEn: 'Saudi Arabia' },
  { code: 'QA', dial: '+974', flag: '🇶🇦', nameFr: 'Qatar', nameEn: 'Qatar' },
  { code: 'TR', dial: '+90',  flag: '🇹🇷', nameFr: 'Turquie', nameEn: 'Turkey' },
  { code: 'IL', dial: '+972', flag: '🇮🇱', nameFr: 'Israël', nameEn: 'Israel' },
  { code: 'AU', dial: '+61',  flag: '🇦🇺', nameFr: 'Australie', nameEn: 'Australia' },
  { code: 'NZ', dial: '+64',  flag: '🇳🇿', nameFr: 'Nouvelle-Zélande', nameEn: 'New Zealand' },
  { code: 'RU', dial: '+7',   flag: '🇷🇺', nameFr: 'Russie', nameEn: 'Russia' },
  { code: 'UA', dial: '+380', flag: '🇺🇦', nameFr: 'Ukraine', nameEn: 'Ukraine' },
  { code: 'PL', dial: '+48',  flag: '🇵🇱', nameFr: 'Pologne', nameEn: 'Poland' },
  { code: 'SE', dial: '+46',  flag: '🇸🇪', nameFr: 'Suède', nameEn: 'Sweden' },
  { code: 'NO', dial: '+47',  flag: '🇳🇴', nameFr: 'Norvège', nameEn: 'Norway' },
  { code: 'DK', dial: '+45',  flag: '🇩🇰', nameFr: 'Danemark', nameEn: 'Denmark' },
  { code: 'FI', dial: '+358', flag: '🇫🇮', nameFr: 'Finlande', nameEn: 'Finland' },
  { code: 'GR', dial: '+30',  flag: '🇬🇷', nameFr: 'Grèce', nameEn: 'Greece' },
  { code: 'AT', dial: '+43',  flag: '🇦🇹', nameFr: 'Autriche', nameEn: 'Austria' },
  { code: 'CZ', dial: '+420', flag: '🇨🇿', nameFr: 'Tchéquie', nameEn: 'Czechia' },
  { code: 'RO', dial: '+40',  flag: '🇷🇴', nameFr: 'Roumanie', nameEn: 'Romania' },
];

export const findCountryByCode = (code?: string | null): Country | undefined =>
  COUNTRIES.find(c => c.code === (code || '').toUpperCase());

export const findCountryByDial = (dial: string): Country | undefined =>
  COUNTRIES.find(c => c.dial === dial);

export const DEFAULT_COUNTRY_CODE = 'CI';

/** Produce a localized, alphabetized list keeping CI/SN/BJ/BF/ML at the top as suggested defaults. */
export const getOrderedCountries = (locale: 'fr' | 'en'): Country[] => {
  const priority = ['CI', 'SN', 'BJ', 'BF', 'ML', 'TG', 'NE', 'CM', 'FR', 'CA', 'BE'];
  const top = priority.map(p => COUNTRIES.find(c => c.code === p)).filter(Boolean) as Country[];
  const rest = COUNTRIES
    .filter(c => !priority.includes(c.code))
    .sort((a, b) => (locale === 'fr' ? a.nameFr.localeCompare(b.nameFr) : a.nameEn.localeCompare(b.nameEn)));
  return [...top, ...rest];
};