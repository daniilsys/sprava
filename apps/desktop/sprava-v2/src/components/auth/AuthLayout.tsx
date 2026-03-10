interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--color-elevated)_0%,_var(--color-bg)_70%)]">
      <div className="flex flex-col items-center gap-6 animate-fade-slide-up">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-primary">
          Sprava
        </h1>
        <div className="w-[420px] rounded-2xl border border-border bg-surface p-8 shadow-2xl">
          {children}
        </div>
      </div>
    </div>
  );
}
