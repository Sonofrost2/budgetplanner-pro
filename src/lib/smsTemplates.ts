// Reusable SMS templates for BudgetPlanner-Pro.
// Keep messages short (<160 chars where possible) and avoid URLs/emojis that
// might trigger carrier filtering. Variables use {placeholders}.

export type SmsTemplateId =
  | 'test_ping'
  | 'welcome'
  | 'budget_alert'
  | 'large_transaction'
  | 'low_balance'
  | 'goal_reached'
  | 'recurring_due'
  | 'weekly_summary'
  | 'payment_receipt'
  | 'subscription_expiry';

export interface SmsTemplate {
  id: SmsTemplateId;
  label_fr: string;
  label_en: string;
  build: (vars: Record<string, string | number>, locale: 'fr' | 'en') => string;
}

import { formatExample, type ExampleKey } from './currency';

const fmt = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));

export const SMS_TEMPLATES: SmsTemplate[] = [
  {
    id: 'test_ping',
    label_fr: 'Test de connexion',
    label_en: 'Connection test',
    build: (_v, l) =>
      l === 'fr'
        ? 'BudgetPlanner-Pro : test de notification reçu avec succès.'
        : 'BudgetPlanner-Pro: notification test received successfully.',
  },
  {
    id: 'welcome',
    label_fr: 'Bienvenue',
    label_en: 'Welcome',
    build: (v, l) =>
      fmt(
        l === 'fr'
          ? 'BudgetPlanner-Pro : bienvenue {name} ! Vos notifications SMS sont actives.'
          : 'BudgetPlanner-Pro: welcome {name}! Your SMS notifications are active.',
        { name: v.name ?? '' },
      ),
  },
  {
    id: 'budget_alert',
    label_fr: 'Alerte budget',
    label_en: 'Budget alert',
    build: (v, l) =>
      fmt(
        l === 'fr'
          ? 'BudgetPlanner-Pro : budget {category} consommé à {percent}% ({spent}/{limit}).'
          : 'BudgetPlanner-Pro: {category} budget at {percent}% ({spent}/{limit}).',
        v,
      ),
  },
  {
    id: 'large_transaction',
    label_fr: 'Transaction importante',
    label_en: 'Large transaction',
    build: (v, l) =>
      fmt(
        l === 'fr'
          ? 'BudgetPlanner-Pro : transaction de {amount} detectee sur {account} ({description}).'
          : 'BudgetPlanner-Pro: {amount} transaction detected on {account} ({description}).',
        v,
      ),
  },
  {
    id: 'low_balance',
    label_fr: 'Solde faible',
    label_en: 'Low balance',
    build: (v, l) =>
      fmt(
        l === 'fr'
          ? 'BudgetPlanner-Pro : solde faible sur {account} ({balance}). Pensez a recharger.'
          : 'BudgetPlanner-Pro: low balance on {account} ({balance}). Consider topping up.',
        v,
      ),
  },
  {
    id: 'goal_reached',
    label_fr: 'Objectif atteint',
    label_en: 'Goal reached',
    build: (v, l) =>
      fmt(
        l === 'fr'
          ? 'BudgetPlanner-Pro : objectif "{goal}" atteint a 100% ({amount}). Felicitations !'
          : 'BudgetPlanner-Pro: goal "{goal}" reached 100% ({amount}). Congrats!',
        v,
      ),
  },
  {
    id: 'recurring_due',
    label_fr: 'Récurrence à venir',
    label_en: 'Recurring due',
    build: (v, l) =>
      fmt(
        l === 'fr'
          ? 'BudgetPlanner-Pro : "{description}" ({amount}) prevue le {date}.'
          : 'BudgetPlanner-Pro: "{description}" ({amount}) scheduled on {date}.',
        v,
      ),
  },
  {
    id: 'weekly_summary',
    label_fr: 'Résumé hebdomadaire',
    label_en: 'Weekly summary',
    build: (v, l) =>
      fmt(
        l === 'fr'
          ? 'BudgetPlanner-Pro : semaine close. Revenus {income}, depenses {expense}, solde {balance}.'
          : 'BudgetPlanner-Pro: week closed. Income {income}, expenses {expense}, balance {balance}.',
        v,
      ),
  },
  {
    id: 'payment_receipt',
    label_fr: 'Reçu de paiement',
    label_en: 'Payment receipt',
    build: (v, l) =>
      fmt(
        l === 'fr'
          ? 'BudgetPlanner-Pro : paiement {amount} confirme pour le plan {plan}. Merci !'
          : 'BudgetPlanner-Pro: {amount} payment confirmed for {plan} plan. Thank you!',
        v,
      ),
  },
  {
    id: 'subscription_expiry',
    label_fr: 'Expiration abonnement',
    label_en: 'Subscription expiry',
    build: (v, l) =>
      fmt(
        l === 'fr'
          ? 'BudgetPlanner-Pro : votre abonnement {plan} expire le {date}. Renouvelez pour continuer.'
          : 'BudgetPlanner-Pro: your {plan} subscription expires on {date}. Renew to continue.',
        v,
      ),
  },
];

/**
 * Sample variables used for previews & test sends.
 * Amounts are derived from the active currency so that "FCFA" / "€" / "$"
 * placeholders stay coherent with the user's profile.
 */
export const buildSmsSamples = (
  currency: string = 'XOF',
  locale: 'fr' | 'en' = 'fr',
): Record<SmsTemplateId, Record<string, string | number>> => {
  const ex = (k: ExampleKey) => formatExample(k, currency, locale);
  return {
    test_ping: {},
    welcome: { name: 'Cedric' },
    budget_alert: { category: locale === 'fr' ? 'Alimentation' : 'Food', percent: 92, spent: ex('groceries'), limit: ex('groceries') },
    large_transaction: { amount: ex('large'), account: 'Wave', description: locale === 'fr' ? 'Loyer' : 'Rent' },
    low_balance: { account: 'Orange Money', balance: ex('low') },
    goal_reached: { goal: locale === 'fr' ? 'Vacances' : 'Vacation', amount: ex('goal') },
    recurring_due: { description: locale === 'fr' ? 'Abonnement Netflix' : 'Netflix subscription', amount: ex('subscription'), date: '01/12' },
    weekly_summary: { income: ex('salary'), expense: ex('rent'), balance: ex('monthly') },
    payment_receipt: { amount: ex('subscription'), plan: 'Pro' },
    subscription_expiry: { plan: 'Pro', date: '15/12/2026' },
  };
};

/** @deprecated Use buildSmsSamples(currency, locale) instead. Kept for backward compatibility. */
export const SMS_TEMPLATE_SAMPLES = buildSmsSamples('XOF', 'fr');

export function renderTemplate(
  id: SmsTemplateId,
  locale: 'fr' | 'en',
  vars?: Record<string, string | number>,
): string {
  const tpl = SMS_TEMPLATES.find((t) => t.id === id);
  if (!tpl) return '';
  const v = vars ?? buildSmsSamples('XOF', locale)[id];
  return tpl.build(v, locale);
}

/** Render an arbitrary template body string with {placeholders}. */
export function renderBody(
  body: string,
  vars: Record<string, string | number> = {},
): string {
  return fmt(body, vars);
}

/** Extract unique {placeholder} names from a template body. */
export function extractPlaceholders(body: string): string[] {
  const set = new Set<string>();
  const re = /\{(\w+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) set.add(m[1]);
  return Array.from(set);
}

/** Default body strings (FR/EN) for each template, derived from the built-in builders. */
export function getDefaultBodies(id: SmsTemplateId): { fr: string; en: string } {
  // Build with identity-preserving placeholders so {x} stays as {x}.
  const sample = SMS_TEMPLATE_SAMPLES[id] || {};
  const placeholderVars: Record<string, string> = {};
  for (const k of Object.keys(sample)) placeholderVars[k] = `{${k}}`;
  const tpl = SMS_TEMPLATES.find((t) => t.id === id);
  if (!tpl) return { fr: '', en: '' };
  return {
    fr: tpl.build(placeholderVars, 'fr'),
    en: tpl.build(placeholderVars, 'en'),
  };
}