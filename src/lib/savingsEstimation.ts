// Savings goal estimation helpers — pure functions (used in goal form)

export type ContributionFrequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly';

export type GoalWarning = {
  level: 'error' | 'warn' | 'info' | 'success';
  code: string;
  fr: string;
  en: string;
};

/** Convert a per-frequency contribution to its monthly equivalent. */
export function contributionToMonthly(amount: number, frequency: ContributionFrequency): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  switch (frequency) {
    case 'weekly':
      return amount * 4.333;
    case 'biweekly':
      return amount * 2.167;
    case 'quarterly':
      return amount / 3;
    case 'monthly':
    default:
      return amount;
  }
}

export function monthsBetween(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

export interface GoalEstimationInput {
  target: number;
  current: number;
  contribution: number;
  frequency: ContributionFrequency;
  startDate: string | null;
  deadline: string | null;
  interestRatePct: number; // 0-100
}

export interface GoalEstimationResult {
  monthlyEq: number;
  remaining: number;
  monthsToTarget: number | null;
  estimatedDeadline: Date | null;
  requiredContribution: number | null; // per selected frequency, to hit deadline
  monthsAvailable: number | null;
  warnings: GoalWarning[];
  hasEnoughData: boolean;
}

/** Compute a live estimation, using compound growth when interest rate > 0. */
export function computeGoalEstimation(input: GoalEstimationInput): GoalEstimationResult {
  const target = Number(input.target) || 0;
  const current = Number(input.current) || 0;
  const contribution = Number(input.contribution) || 0;
  const rate = Math.max(0, Number(input.interestRatePct) || 0);
  const monthly = contributionToMonthly(contribution, input.frequency);
  const remaining = Math.max(0, target - current);
  const warnings: GoalWarning[] = [];

  const start = input.startDate ? new Date(input.startDate) : new Date();
  const dl = input.deadline ? new Date(input.deadline) : null;

  let monthsToTarget: number | null = null;
  let estimatedDeadline: Date | null = null;
  let requiredContribution: number | null = null;
  let monthsAvailable: number | null = null;

  // --- Coherence checks ---
  if (dl && input.startDate && dl.getTime() < start.getTime()) {
    warnings.push({
      level: 'error',
      code: 'deadline_before_start',
      fr: "L'échéance est antérieure à la date de début.",
      en: 'Deadline is before start date.',
    });
  }

  if (target > 0 && current >= target) {
    warnings.push({
      level: 'success',
      code: 'already_reached',
      fr: 'Objectif déjà atteint : le solde actuel couvre la cible.',
      en: 'Goal already reached: current amount covers the target.',
    });
  }

  if (rate > 30) {
    warnings.push({
      level: 'warn',
      code: 'unrealistic_rate',
      fr: `Taux ${rate}% peu réaliste pour un compte d'épargne — vérifiez.`,
      en: `Rate ${rate}% is unrealistic for savings — please double-check.`,
    });
  }

  // --- Estimation: time to reach ---
  if (remaining > 0 && monthly > 0) {
    if (rate > 0) {
      const r = rate / 100 / 12;
      const n = Math.log(1 + (remaining * r) / monthly) / Math.log(1 + r);
      monthsToTarget = Number.isFinite(n) && n > 0 ? n : null;
    } else {
      monthsToTarget = remaining / monthly;
    }
    if (monthsToTarget && Number.isFinite(monthsToTarget)) {
      estimatedDeadline = new Date(start);
      estimatedDeadline.setMonth(estimatedDeadline.getMonth() + Math.ceil(monthsToTarget));
    }
  }

  // --- Estimation: contribution required to hit deadline ---
  if (dl && remaining > 0) {
    monthsAvailable = Math.max(0, monthsBetween(start, dl));
    if (monthsAvailable > 0) {
      const r = rate / 100 / 12;
      const requiredMonthly = r > 0
        ? (remaining * r) / (Math.pow(1 + r, monthsAvailable) - 1)
        : remaining / monthsAvailable;
      // Convert back to selected frequency for user
      const monthlyToFreq: Record<ContributionFrequency, number> = {
        weekly: 1 / 4.333,
        biweekly: 1 / 2.167,
        monthly: 1,
        quarterly: 3,
      };
      requiredContribution = requiredMonthly * monthlyToFreq[input.frequency];
    } else if (dl.getTime() >= start.getTime()) {
      warnings.push({
        level: 'warn',
        code: 'deadline_too_close',
        fr: 'Échéance trop proche pour planifier un versement mensuel régulier.',
        en: 'Deadline is too close to plan a regular monthly contribution.',
      });
    }
  }

  // --- Pace vs deadline ---
  if (dl && monthly > 0 && monthsToTarget && monthsAvailable !== null && monthsAvailable > 0) {
    if (monthsToTarget > monthsAvailable + 1) {
      const delta = Math.ceil(monthsToTarget - monthsAvailable);
      warnings.push({
        level: 'warn',
        code: 'pace_too_slow',
        fr: `Au rythme actuel, l'objectif serait atteint ${delta} mois après l'échéance.`,
        en: `At current pace, goal would be reached ${delta} months after deadline.`,
      });
    } else if (monthsToTarget < monthsAvailable * 0.5) {
      warnings.push({
        level: 'info',
        code: 'pace_fast',
        fr: "Rythme confortable : vous atteindrez l'objectif bien avant l'échéance.",
        en: 'Comfortable pace: you will reach the goal well before deadline.',
      });
    }
  }

  // --- Contribution sanity ---
  if (contribution > 0 && target > 0 && contribution > target) {
    warnings.push({
      level: 'warn',
      code: 'contribution_over_target',
      fr: 'Le versement dépasse la cible : un versement suffit — envisagez un objectif plus ambitieux.',
      en: 'Contribution exceeds target: one deposit is enough — consider a bigger goal.',
    });
  }

  const hasEnoughData = target > 0 && (monthly > 0 || !!dl);

  return {
    monthlyEq: monthly,
    remaining,
    monthsToTarget,
    estimatedDeadline,
    requiredContribution,
    monthsAvailable,
    warnings,
    hasEnoughData,
  };
}

export function formatMonthsHuman(months: number, locale: 'fr' | 'en'): string {
  const m = Math.max(0, Math.round(months));
  if (m < 1) return locale === 'fr' ? 'moins d\'un mois' : 'less than a month';
  if (m < 12) return locale === 'fr' ? `${m} mois` : `${m} month${m > 1 ? 's' : ''}`;
  const years = Math.floor(m / 12);
  const rest = m % 12;
  if (rest === 0) return locale === 'fr' ? `${years} an${years > 1 ? 's' : ''}` : `${years} year${years > 1 ? 's' : ''}`;
  return locale === 'fr'
    ? `${years} an${years > 1 ? 's' : ''} ${rest} mois`
    : `${years}y ${rest}m`;
}