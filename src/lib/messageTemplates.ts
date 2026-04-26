// Unified message templates for Email, SMS, WhatsApp.
// 3 business templates × 3 channels = 9 entries.

export type MessageChannel = 'email' | 'sms' | 'whatsapp';

export type MessageTemplateId = 'welcome' | 're_engagement' | 'trial_reminder';

export interface MessageTemplate {
  id: MessageTemplateId;
  label_fr: string;
  label_en: string;
  description_fr: string;
  description_en: string;
}

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: 'welcome',
    label_fr: 'Bienvenue',
    label_en: 'Welcome',
    description_fr: "Envoyé à l'inscription d'un nouvel utilisateur.",
    description_en: 'Sent when a new user signs up.',
  },
  {
    id: 're_engagement',
    label_fr: 'Relance',
    label_en: 'Re-engagement',
    description_fr: "Envoyé après une période d'inactivité.",
    description_en: 'Sent after a period of inactivity.',
  },
  {
    id: 'trial_reminder',
    label_fr: "Rappel essai",
    label_en: 'Trial reminder',
    description_fr: "Envoyé avant la fin de la période d'essai.",
    description_en: 'Sent before the trial period ends.',
  },
];

/** Sample variables for previews and test sends. */
export const MESSAGE_TEMPLATE_SAMPLES: Record<MessageTemplateId, Record<string, string>> = {
  welcome: { name: 'Cédric', appName: 'Budget Planner' },
  re_engagement: { name: 'Cédric', daysInactive: '14', appName: 'Budget Planner' },
  trial_reminder: { name: 'Cédric', daysLeft: '3', plan: 'Pro' },
};

/** Default bodies per (channel, templateId). Plain text for SMS/WhatsApp; HTML for email. */
type DefaultBody = { fr: string; en: string };
type EmailDefault = { subject_fr: string; subject_en: string; html_fr: string; html_en: string };

export const DEFAULT_BODIES: Record<Exclude<MessageChannel, 'email'>, Record<MessageTemplateId, DefaultBody>> = {
  sms: {
    welcome: {
      fr: 'Bienvenue {name} sur {appName} ! Votre Coach Financier est pret a vous accompagner.',
      en: 'Welcome {name} to {appName}! Your Finance Coach is ready to help.',
    },
    re_engagement: {
      fr: '{appName} : on vous attend {name} ! Cela fait {daysInactive} jours sans activite. Reprenez la main sur vos finances.',
      en: '{appName}: we miss you {name}! It has been {daysInactive} days. Take back control of your finances.',
    },
    trial_reminder: {
      fr: '{appName} : votre essai du plan {plan} se termine dans {daysLeft} jours. Renouvelez pour continuer.',
      en: '{appName}: your {plan} trial ends in {daysLeft} days. Renew to keep your benefits.',
    },
  },
  whatsapp: {
    welcome: {
      fr: '👋 Bienvenue *{name}* sur *{appName}* !\n\nVotre Coach Financier est pret a vous accompagner. Commencez par creer votre premier compte.',
      en: '👋 Welcome *{name}* to *{appName}*!\n\nYour Finance Coach is ready to help. Start by creating your first account.',
    },
    re_engagement: {
      fr: '👀 Hello *{name}* !\n\nCela fait *{daysInactive} jours* sans activite sur *{appName}*. Vos budgets vous attendent — reprenez la main en quelques clics.',
      en: '👀 Hello *{name}*!\n\nIt has been *{daysInactive} days* without activity on *{appName}*. Your budgets are waiting — pick up where you left off.',
    },
    trial_reminder: {
      fr: '⏳ *{name}*, votre essai *{plan}* se termine dans *{daysLeft} jours*.\n\nRenouvelez pour continuer a profiter de toutes les fonctionnalites.',
      en: '⏳ *{name}*, your *{plan}* trial ends in *{daysLeft} days*.\n\nRenew to keep all premium features.',
    },
  },
};

export const DEFAULT_EMAIL_BODIES: Record<MessageTemplateId, EmailDefault> = {
  welcome: {
    subject_fr: '🎉 Bienvenue sur {appName} !',
    subject_en: '🎉 Welcome to {appName}!',
    html_fr: `<h1>Bienvenue {name} 👋</h1><p>Nous sommes ravis de vous accueillir sur <strong>{appName}</strong>.</p><p>Votre Coach Financier est pret a vous accompagner.</p><p><a href="https://budgetplanner-pro.lovable.app/dashboard">Commencer maintenant →</a></p>`,
    html_en: `<h1>Welcome {name} 👋</h1><p>We're thrilled to welcome you to <strong>{appName}</strong>.</p><p>Your Finance Coach is ready to help.</p><p><a href="https://budgetplanner-pro.lovable.app/dashboard">Get started →</a></p>`,
  },
  re_engagement: {
    subject_fr: '👀 {name}, on vous attend sur {appName}',
    subject_en: '👀 {name}, we miss you on {appName}',
    html_fr: `<h1>Hello {name},</h1><p>Cela fait <strong>{daysInactive} jours</strong> sans activite sur <strong>{appName}</strong>.</p><p>Vos budgets et objectifs sont prets — reprenez la main en quelques clics.</p><p><a href="https://budgetplanner-pro.lovable.app/dashboard">Reprendre →</a></p>`,
    html_en: `<h1>Hello {name},</h1><p>It's been <strong>{daysInactive} days</strong> without activity on <strong>{appName}</strong>.</p><p>Your budgets and goals are waiting — pick up where you left off.</p><p><a href="https://budgetplanner-pro.lovable.app/dashboard">Resume →</a></p>`,
  },
  trial_reminder: {
    subject_fr: '⏳ Votre essai {plan} se termine dans {daysLeft} jours',
    subject_en: '⏳ Your {plan} trial ends in {daysLeft} days',
    html_fr: `<h1>Bonjour {name},</h1><p>Votre essai du plan <strong>{plan}</strong> se termine dans <strong>{daysLeft} jours</strong>.</p><p>Renouvelez pour continuer a profiter de toutes les fonctionnalites premium.</p><p><a href="https://budgetplanner-pro.lovable.app/dashboard/payment">Renouveler →</a></p>`,
    html_en: `<h1>Hello {name},</h1><p>Your <strong>{plan}</strong> trial ends in <strong>{daysLeft} days</strong>.</p><p>Renew now to keep all premium features.</p><p><a href="https://budgetplanner-pro.lovable.app/dashboard/payment">Renew →</a></p>`,
  },
};

const fmt = (s: string, vars: Record<string, string>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : `{${k}}`));

export const renderMsg = fmt;

export function extractPlaceholders(...bodies: string[]): string[] {
  const set = new Set<string>();
  const re = /\{(\w+)\}/g;
  for (const body of bodies) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(body)) !== null) set.add(m[1]);
  }
  return Array.from(set);
}
