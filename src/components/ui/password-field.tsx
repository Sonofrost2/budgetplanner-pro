import * as React from "react";
import { Eye, EyeOff, Lock, Check, X, Wand2, AlertTriangle, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export interface PasswordCriteria {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
}

export const evaluatePassword = (pwd: string): { score: number; criteria: PasswordCriteria } => {
  const criteria: PasswordCriteria = {
    minLength: pwd.length >= 8,
    hasUppercase: /[A-Z]/.test(pwd),
    hasLowercase: /[a-z]/.test(pwd),
    hasNumber: /\d/.test(pwd),
    hasSymbol: /[^A-Za-z0-9]/.test(pwd),
  };
  const passed = Object.values(criteria).filter(Boolean).length;
  // Bonus length
  let bonus = 0;
  if (pwd.length >= 12) bonus += 1;
  if (pwd.length >= 16) bonus += 1;
  const score = Math.min(5, passed + bonus - (passed >= 5 ? 0 : 0));
  return { score, criteria };
};

const generateStrongPassword = (length = 16): string => {
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%^&*-_+=?";
  const all = lower + upper + digits + symbols;
  const rand = (set: string) => set[Math.floor(Math.random() * set.length)];
  const required = [rand(lower), rand(upper), rand(digits), rand(symbols)];
  const rest = Array.from({ length: length - required.length }, () => rand(all));
  return [...required, ...rest].sort(() => Math.random() - 0.5).join("");
};

interface PasswordFieldProps extends Omit<React.ComponentProps<"input">, "type"> {
  label?: string;
  hint?: string;
  error?: string;
  showStrength?: boolean;
  showChecklist?: boolean;
  showGenerate?: boolean;
  showMatch?: boolean;
  matchValue?: string;
  matchLabel?: string;
  locale?: "fr" | "en";
  onGenerated?: (pwd: string) => void;
}

const i18n = {
  fr: {
    show: "Afficher",
    hide: "Masquer",
    capsLock: "Verr. Maj activé",
    weak: "Faible",
    fair: "Moyen",
    good: "Bon",
    strong: "Fort",
    excellent: "Excellent",
    minLength: "8 caractères minimum",
    upper: "Une majuscule (A-Z)",
    lower: "Une minuscule (a-z)",
    number: "Un chiffre (0-9)",
    symbol: "Un symbole (!@#$…)",
    generate: "Générer un mot de passe fort",
    generated: "Mot de passe généré et copié ✨",
    matchOk: "Les mots de passe correspondent",
    matchKo: "Les mots de passe ne correspondent pas",
    copy: "Copier",
    showA11y: "Afficher le mot de passe",
    hideA11y: "Masquer le mot de passe",
    strengthLabel: "Force du mot de passe",
    strengthAnnounce: (s: string) => `Force du mot de passe : ${s}`,
    checklistLabel: "Critères du mot de passe",
    criterionMet: "rempli",
    criterionNotMet: "non rempli",
  },
  en: {
    show: "Show",
    hide: "Hide",
    capsLock: "Caps Lock is on",
    weak: "Weak",
    fair: "Fair",
    good: "Good",
    strong: "Strong",
    excellent: "Excellent",
    minLength: "At least 8 characters",
    upper: "One uppercase (A-Z)",
    lower: "One lowercase (a-z)",
    number: "One digit (0-9)",
    symbol: "One symbol (!@#$…)",
    generate: "Generate strong password",
    generated: "Password generated and copied ✨",
    matchOk: "Passwords match",
    matchKo: "Passwords don't match",
    copy: "Copy",
    showA11y: "Show password",
    hideA11y: "Hide password",
    strengthLabel: "Password strength",
    strengthAnnounce: (s: string) => `Password strength: ${s}`,
    checklistLabel: "Password requirements",
    criterionMet: "met",
    criterionNotMet: "not met",
  },
};

// ─── Centralized password policy ───
export const PASSWORD_POLICY = {
  minLength: 8,
  minScore: 3, // out of 5
} as const;

export type PasswordValidationOk = { ok: true; message?: undefined; code?: undefined };
export type PasswordValidationError = {
  ok: false;
  code: "empty" | "tooShort" | "tooWeak" | "mismatch";
  message: string;
};
export type PasswordValidationResult = PasswordValidationOk | PasswordValidationError;

const validationMessages = {
  fr: {
    empty: "Mot de passe requis",
    tooShort: `Mot de passe trop court (${PASSWORD_POLICY.minLength} caractères min.)`,
    tooWeak: "Mot de passe trop faible — ajoutez majuscule, chiffre ou symbole",
    mismatch: "Les mots de passe ne correspondent pas",
  },
  en: {
    empty: "Password required",
    tooShort: `Password too short (${PASSWORD_POLICY.minLength} chars min.)`,
    tooWeak: "Password too weak — add uppercase, digit or symbol",
    mismatch: "Passwords don't match",
  },
};

/**
 * Centralized signup/reset password validation.
 * Use the same rules across Signup, ResetPassword (and any other "set password" flow).
 */
export const validateNewPassword = (
  password: string,
  confirmation?: string,
  locale: "fr" | "en" = "fr"
): PasswordValidationResult => {
  const m = validationMessages[locale];
  if (!password) return { ok: false, code: "empty", message: m.empty };
  const { score, criteria } = evaluatePassword(password);
  if (!criteria.minLength) return { ok: false, code: "tooShort", message: m.tooShort };
  if (score < PASSWORD_POLICY.minScore) return { ok: false, code: "tooWeak", message: m.tooWeak };
  if (confirmation !== undefined && password !== confirmation) {
    return { ok: false, code: "mismatch", message: m.mismatch };
  }
  return { ok: true };
};

/**
 * Lightweight validation for the Login screen — we only check that the field
 * is not empty (we never want to lock out users whose existing password is
 * shorter than the current policy).
 */
export const validateLoginPassword = (
  password: string,
  locale: "fr" | "en" = "fr"
): PasswordValidationResult => {
  const m = validationMessages[locale];
  if (!password) return { ok: false, code: "empty", message: m.empty };
  return { ok: true };
};

const strengthMeta = (score: number, l: typeof i18n.fr) => {
  if (score <= 1) return { label: l.weak, color: "bg-destructive", text: "text-destructive", width: "20%" };
  if (score === 2) return { label: l.fair, color: "bg-orange-500", text: "text-orange-500", width: "40%" };
  if (score === 3) return { label: l.good, color: "bg-yellow-500", text: "text-yellow-600 dark:text-yellow-400", width: "60%" };
  if (score === 4) return { label: l.strong, color: "bg-secondary", text: "text-secondary", width: "80%" };
  return { label: l.excellent, color: "bg-primary", text: "text-primary", width: "100%" };
};

const PasswordField = React.forwardRef<HTMLInputElement, PasswordFieldProps>(
  (
    {
      className,
      label,
      hint,
      error,
      showStrength = false,
      showChecklist = false,
      showGenerate = false,
      showMatch = false,
      matchValue,
      matchLabel,
      locale = "fr",
      onGenerated,
      onChange,
      value,
      ...props
    },
    ref
  ) => {
    const [visible, setVisible] = React.useState(false);
    const [capsOn, setCapsOn] = React.useState(false);
    const l = i18n[locale];
    const pwd = typeof value === "string" ? value : "";
    const { score, criteria } = React.useMemo(() => evaluatePassword(pwd), [pwd]);
    const meta = strengthMeta(score, l);

    // Stable IDs for ARIA relationships
    const reactId = React.useId();
    const inputId = (props.id as string | undefined) ?? `pwd-${reactId}`;
    const strengthId = `${inputId}-strength`;
    const checklistId = `${inputId}-checklist`;
    const matchId = `${inputId}-match`;
    const capsId = `${inputId}-caps`;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (typeof e.getModifierState === "function") {
        setCapsOn(e.getModifierState("CapsLock"));
      }
    };

    const handleGenerate = async () => {
      const newPwd = generateStrongPassword(16);
      onGenerated?.(newPwd);
      // Synth event for controlled inputs
      if (onChange) {
        const synth = { target: { value: newPwd } } as React.ChangeEvent<HTMLInputElement>;
        onChange(synth);
      }
      try {
        await navigator.clipboard.writeText(newPwd);
        toast.success(l.generated);
      } catch {
        toast.success(l.generated);
      }
      setVisible(true);
    };

    const matches = showMatch && matchValue !== undefined && pwd.length > 0 && matchValue.length > 0
      ? pwd === matchValue
      : null;

    const describedBy = [
      showStrength && pwd.length > 0 ? strengthId : null,
      showChecklist && pwd.length > 0 ? checklistId : null,
      showMatch && matches !== null ? matchId : null,
      capsOn ? capsId : null,
      error ? errorId : null,
      hint && !error ? hintId : null,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

    return (
      <div className="space-y-1.5">
        {label && (
          <div className="flex items-center justify-between">
            <label htmlFor={inputId} className="form-label flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-primary/70" />
              {label}
            </label>
            {showGenerate && (
              <button
                type="button"
                onClick={handleGenerate}
                aria-label={l.generate}
                className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1 transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background"
              >
                <Wand2 className="w-3 h-3" />
                {l.generate}
              </button>
            )}
          </div>
        )}

        <div
          className={cn(
            "group relative flex items-center rounded-xl border bg-background/60 backdrop-blur-sm transition-all duration-200",
            "shadow-sm hover:bg-background/80",
            "focus-within:bg-background focus-within:border-primary/60 focus-within:shadow-[0_0_0_3px_hsl(var(--ring)/0.15)]",
            error
              ? "border-destructive/60 focus-within:border-destructive focus-within:shadow-[0_0_0_3px_hsl(var(--destructive)/0.18)]"
              : "border-border/60",
            className
          )}
        >
          <Lock className="ml-3 w-4 h-4 text-muted-foreground group-focus-within:text-primary flex-shrink-0 transition-colors" />
          <input
            ref={ref}
            type={visible ? "text" : "password"}
            value={value}
            onChange={onChange}
            onKeyDown={handleKey}
            onKeyUp={handleKey}
            className={cn(
              "flex-1 h-11 bg-transparent px-3 py-2 text-base ring-0 outline-none",
              "placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            )}
            {...props}
          />
          {showMatch && matches !== null && (
            <span
              className={cn(
                "mr-1 flex items-center justify-center w-6 h-6 rounded-full transition-all",
                matches ? "bg-secondary/15 text-secondary" : "bg-destructive/15 text-destructive"
              )}
              title={matches ? l.matchOk : l.matchKo}
            >
              {matches ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
            </span>
          )}
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="mr-2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            aria-label={visible ? l.hide : l.show}
            tabIndex={-1}
          >
            {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <AnimatePresence>
          {capsOn && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-medium"
            >
              <AlertTriangle className="w-3 h-3" />
              {l.capsLock}
            </motion.div>
          )}
        </AnimatePresence>

        {showStrength && pwd.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-1 pt-0.5"
          >
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Force</span>
              <span className={cn("font-semibold tabular-nums", meta.text)}>{meta.label}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
              <motion.div
                className={cn("h-full rounded-full transition-colors", meta.color)}
                initial={{ width: 0 }}
                animate={{ width: meta.width }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              />
            </div>
          </motion.div>
        )}

        {showChecklist && pwd.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5 pt-1"
          >
            {[
              { ok: criteria.minLength, label: l.minLength },
              { ok: criteria.hasUppercase, label: l.upper },
              { ok: criteria.hasLowercase, label: l.lower },
              { ok: criteria.hasNumber, label: l.number },
              { ok: criteria.hasSymbol, label: l.symbol },
            ].map((c, i) => (
              <li
                key={i}
                className={cn(
                  "flex items-center gap-1.5 text-[11px] transition-colors",
                  c.ok ? "text-secondary" : "text-muted-foreground/70"
                )}
              >
                <span
                  className={cn(
                    "flex items-center justify-center w-3.5 h-3.5 rounded-full transition-all flex-shrink-0",
                    c.ok ? "bg-secondary/20" : "bg-muted/60"
                  )}
                >
                  {c.ok ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5 opacity-50" />}
                </span>
                <span>{c.label}</span>
              </li>
            ))}
          </motion.ul>
        )}

        {showMatch && matchLabel && matches !== null && (
          <p
            className={cn(
              "text-[11px] font-medium flex items-center gap-1",
              matches ? "text-secondary" : "text-destructive"
            )}
          >
            <span className={cn("inline-block w-1 h-1 rounded-full", matches ? "bg-secondary" : "bg-destructive")} />
            {matches ? l.matchOk : l.matchKo}
          </p>
        )}

        {error && (
          <p className="text-[11px] text-destructive font-medium flex items-center gap-1">
            <span className="inline-block w-1 h-1 rounded-full bg-destructive" />
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-[10px] text-muted-foreground/70">{hint}</p>
        )}
      </div>
    );
  }
);

PasswordField.displayName = "PasswordField";

export { PasswordField, generateStrongPassword };