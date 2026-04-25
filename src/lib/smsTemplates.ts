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

/** Sample variables used for previews & test sends. */
export const SMS_TEMPLATE_SAMPLES: Record<SmsTemplateId, Record<string, string | number>> = {
  test_ping: {},
  welcome: { name: 'Cedric' },
  budget_alert: { category: 'Alimentation', percent: 92, spent: '46 000 XOF', limit: '50 000 XOF' },
  large_transaction: { amount: '125 000 XOF', account: 'Wave', description: 'Loyer' },
  low_balance: { account: 'Orange Money', balance: '2 500 XOF' },
  goal_reached: { goal: 'Vacances', amount: '500 000 XOF' },
  recurring_due: { description: 'Abonnement Netflix', amount: '6 500 XOF', date: '01/12' },
  weekly_summary: { income: '180 000 XOF', expense: '95 000 XOF', balance: '+85 000 XOF' },
  payment_receipt: { amount: '5 000 XOF', plan: 'Pro' },
  subscription_expiry: { plan: 'Pro', date: '15/12/2026' },
};

export function renderTemplate(
  id: SmsTemplateId,
  locale: 'fr' | 'en',
  vars: Record<string, string | number> = SMS_TEMPLATE_SAMPLES[id],
): string {
  const tpl = SMS_TEMPLATES.find((t) => t.id === id);
  if (!tpl) return '';
  return tpl.build(vars, locale);
}