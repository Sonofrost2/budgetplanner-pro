import * as React from "react";
import { cn } from "@/lib/utils";

interface InputFieldProps extends React.ComponentProps<"input"> {
  icon?: React.ReactNode;
  prefix?: string;
  suffix?: string;
  hint?: string;
  error?: string;
  label?: string;
  charCount?: boolean;
}

/**
 * Premium glass input — Coach Financier design system.
 * - Glass surface with refined focus ring + primary glow
 * - Inline icon / prefix / suffix slots
 * - Animated error state with shake + inline message
 * - Char counter that turns destructive past 90% of maxLength
 */
const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
  (
    {
      className,
      icon,
      prefix,
      suffix,
      hint,
      error,
      label,
      charCount,
      maxLength,
      value,
      ...props
    },
    ref
  ) => {
    const currentLength = typeof value === "string" ? value.length : 0;

    return (
      <div className={cn("space-y-1.5", error && "field-error-shake")}>
        {label && (
          <label className="form-label flex items-center gap-1.5">
            {icon && <span className="text-primary/70">{icon}</span>}
            {label}
          </label>
        )}
        <div
          className={cn(
            "group flex items-center gap-0 rounded-xl border bg-background/60 backdrop-blur-sm transition-all duration-200",
            "shadow-sm hover:bg-background/80",
            "focus-within:bg-background focus-within:border-primary/60 focus-within:shadow-[0_0_0_3px_hsl(var(--ring)/0.15)]",
            error
              ? "border-destructive/60 focus-within:border-destructive focus-within:shadow-[0_0_0_3px_hsl(var(--destructive)/0.18)]"
              : "border-border/60",
            className
          )}
        >
          {!label && icon && (
            <span className="pl-3 text-muted-foreground group-focus-within:text-primary flex-shrink-0 transition-colors">
              {icon}
            </span>
          )}
          {prefix && (
            <span className="pl-3 text-xs font-bold text-muted-foreground flex-shrink-0 select-none">
              {prefix}
            </span>
          )}
          <input
            ref={ref}
            value={value}
            maxLength={maxLength}
            className={cn(
              "flex-1 h-11 bg-transparent px-3 py-2 text-base ring-0 outline-none",
              "placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              prefix && "pl-1.5",
              suffix && "pr-1.5"
            )}
            {...props}
          />
          {suffix && (
            <span className="pr-3 text-xs font-semibold text-muted-foreground flex-shrink-0 select-none">
              {suffix}
            </span>
          )}
        </div>
        <div className="flex items-start justify-between gap-2 min-h-[1rem]">
          <div className="flex-1">
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
          {charCount && maxLength && (
            <span
              className={cn(
                "text-[10px] tabular-nums flex-shrink-0 font-medium",
                currentLength > maxLength * 0.9
                  ? "text-destructive"
                  : "text-muted-foreground/50"
              )}
            >
              {currentLength}/{maxLength}
            </span>
          )}
        </div>
      </div>
    );
  }
);

InputField.displayName = "InputField";

export { InputField };
export type { InputFieldProps };
