import { ButtonHTMLAttributes, forwardRef } from "react";

type Size = "sm" | "md" | "lg";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: Size;
  active?: boolean;
}

const sizeClasses: Record<Size, string> = {
  sm: "w-7 h-7",
  md: "w-9 h-9",
  lg: "w-11 h-11",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ size = "md", active, className = "", children, ...props }, ref) => (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center rounded-full transition-all duration-[var(--duration-feedback)] hover:bg-elevated active:bg-elevated-2 active:scale-90 disabled:opacity-50 disabled:pointer-events-none ${
        active ? "bg-elevated text-text-primary" : "text-text-secondary"
      } ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  ),
);
