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

const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
  ({ className, icon, prefix, suffix, hint, error, label, charCount, maxLength, value, ...props }, ref) => {
    const currentLength = typeof value === 'string' ? value.length : 0;

    return (
      <div className="space-y-1.5">
        {label && (
          <label className="form-label flex items-center gap-1.5">
            {icon && <span className="text-muted-foreground">{icon}</span>}
            {label}
          </label>
        )}
        <div className={cn(
          "flex items-center gap-0 rounded-xl border bg-background transition-all duration-200",
          "focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50",
          error ? "border-destructive focus-within:ring-destructive/20 focus-within:border-destructive/50" : "border-input",
          className
        )}>
          {!label && icon && (
            <span className="pl-3 text-muted-foreground flex-shrink-0">{icon}</span>
          )}
          {prefix && (
            <span className="pl-3 text-xs font-bold text-muted-foreground flex-shrink-0 select-none">{prefix}</span>
          )}
          <input
            ref={ref}
            value={value}
            maxLength={maxLength}
            className={cn(
              "flex-1 h-11 bg-transparent px-3 py-2 text-base ring-0 outline-none",
              "placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              prefix && "pl-1.5",
              suffix && "pr-1.5",
            )}
            {...props}
          />
          {suffix && (
            <span className="pr-3 text-xs font-semibold text-muted-foreground flex-shrink-0 select-none">{suffix}</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            {error && <p className="text-xs text-destructive">{error}</p>}
            {hint && !error && <p className="text-[10px] text-muted-foreground">{hint}</p>}
          </div>
          {charCount && maxLength && (
            <span className={cn(
              "text-[10px] tabular-nums flex-shrink-0",
              currentLength > maxLength * 0.9 ? "text-destructive" : "text-muted-foreground/50"
            )}>
              {currentLength}/{maxLength}
            </span>
          )}
        </div>
      </div>
    );
  },
);

InputField.displayName = "InputField";

export { InputField };
export type { InputFieldProps };
