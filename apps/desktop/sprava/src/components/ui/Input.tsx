import { forwardRef } from "react";

interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ prefix, suffix, error, className = "", ...props }, ref) => (
    <div className="flex flex-col gap-1">
      <div
        className={`flex items-center gap-2 rounded-lg border bg-elevated px-3 py-2 transition-all duration-[var(--duration-feedback)] input-glow ${
          error ? "border-danger" : "border-border"
        } ${className}`}
      >
        {prefix && (
          <span className="text-text-muted flex-shrink-0">{prefix}</span>
        )}
        <input
          ref={ref}
          className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted outline-none text-sm focus-visible:outline-none"
          {...props}
        />
        {suffix && (
          <span className="text-text-muted flex-shrink-0">{suffix}</span>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  ),
);
