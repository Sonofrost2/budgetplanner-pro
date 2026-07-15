// Preset templates for common savings goals.
// Keep this list short & culturally relevant (West African context).
export interface SavingsTemplate {
  key: string;
  icon: string;
  labelFr: string;
  labelEn: string;
  target: number;          // suggested target in XOF
  months: number;          // suggested horizon (months)
  priority: 'low' | 'medium' | 'high';
  purpose: string;         // matches goal.purpose enum used in form
}

export const SAVINGS_TEMPLATES: SavingsTemplate[] = [
  { key: 'emergency', icon: '🛟', labelFr: 'Fonds d\'urgence', labelEn: 'Emergency fund', target: 1_500_000, months: 12, priority: 'high',   purpose: 'security'  },
  { key: 'vacation',  icon: '🌴', labelFr: 'Vacances',         labelEn: 'Vacation',       target:   600_000, months:  6, priority: 'low',    purpose: 'lifestyle' },
  { key: 'car',       icon: '🚗', labelFr: 'Voiture',          labelEn: 'Car',            target: 5_000_000, months: 24, priority: 'medium', purpose: 'mobility'  },
  { key: 'home',      icon: '🏠', labelFr: 'Apport logement',  labelEn: 'Home deposit',   target:10_000_000, months: 36, priority: 'high',   purpose: 'housing'   },
  { key: 'education', icon: '🎓', labelFr: 'Études',           labelEn: 'Education',      target: 2_000_000, months: 18, priority: 'high',   purpose: 'education' },
  { key: 'wedding',   icon: '💍', labelFr: 'Mariage',          labelEn: 'Wedding',        target: 3_000_000, months: 12, priority: 'medium', purpose: 'lifestyle' },
  { key: 'tech',      icon: '💻', labelFr: 'Équipement',       labelEn: 'Equipment',      target:   800_000, months:  8, priority: 'low',    purpose: 'growth'    },
  { key: 'retirement',icon: '🏖️', labelFr: 'Retraite',          labelEn: 'Retirement',     target:20_000_000, months: 60, priority: 'medium', purpose: 'security'  },
];

export const monthsFromNowISO = (months: number): string => {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
};