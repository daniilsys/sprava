import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface AuthLayoutProps {
  children: React.ReactNode;
}

/** Animated floating orbs for atmospheric background */
function FloatingOrbs() {
  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden
    >
      {/* Primary warm orb */}
      <div
        className="absolute rounded-full opacity-[0.07] blur-[100px]"
        style={{
          width: 500,
          height: 500,
          background: "var(--color-primary)",
          top: "-10%",
          right: "-8%",
          animation: "auth-orb-drift 18s ease-in-out infinite alternate",
        }}
      />
      {/* Accent cool orb */}
      <div
        className="absolute rounded-full opacity-[0.05] blur-[120px]"
        style={{
          width: 600,
          height: 600,
          background: "var(--color-accent)",
          bottom: "-15%",
          left: "-12%",
          animation:
            "auth-orb-drift 22s ease-in-out infinite alternate-reverse",
        }}
      />
      {/* Teal small orb */}
      <div
        className="absolute rounded-full opacity-[0.04] blur-[80px]"
        style={{
          width: 300,
          height: 300,
          background: "var(--color-live)",
          top: "40%",
          left: "60%",
          animation: "auth-orb-drift 15s ease-in-out infinite alternate",
        }}
      />
    </div>
  );
}

/** The Sprava mascot rendered inline */
function Mascot({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="24 24 208 208"
      className={className}
      role="img"
      aria-label="Sprava"
    >
      <rect
        x="36"
        y="36"
        width="184"
        height="184"
        rx="56"
        fill="var(--color-elevated)"
        stroke="var(--color-primary)"
        strokeWidth="10"
      />
      <circle
        cx="98"
        cy="108"
        r="14"
        fill="var(--color-text-primary)"
        className="auth-mascot-eye-left"
      />
      <circle
        cx="158"
        cy="108"
        r="14"
        fill="var(--color-text-primary)"
        className="auth-mascot-eye-right"
      />
      <path
        d="M88 158 Q104 140 120 158 T152 158 T184 158"
        stroke="var(--color-live)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/** Subtle grid pattern overlay */
function GridPattern() {
  return (
    <div
      className="absolute inset-0 pointer-events-none opacity-[0.03]"
      aria-hidden
      style={{
        backgroundImage: `
          linear-gradient(var(--color-text-muted) 1px, transparent 1px),
          linear-gradient(90deg, var(--color-text-muted) 1px, transparent 1px)
        `,
        backgroundSize: "60px 60px",
        maskImage:
          "radial-gradient(ellipse at center, black 0%, transparent 70%)",
        WebkitMaskImage:
          "radial-gradient(ellipse at center, black 0%, transparent 70%)",
      }}
    />
  );
}

const LANGS = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
] as const;

export function AuthLayout({ children }: AuthLayoutProps) {
  const { i18n } = useTranslation();
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [langOpen, setLangOpen] = useState(false);

  const currentLang = LANGS.find((l) => l.code === i18n.language) || LANGS[0];

  // Subtle card tilt on mouse move
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setMousePos({
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
      });
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  const tiltX = (mousePos.y - 0.5) * 3;
  const tiltY = (mousePos.x - 0.5) * -3;
  const glareX = mousePos.x * 100;
  const glareY = mousePos.y * 100;

  return (
    <div className="relative flex h-screen w-screen items-center justify-center bg-bg overflow-hidden">
      <FloatingOrbs />
      <GridPattern />

      {/* Language selector */}
      <div className="absolute top-5 right-5 z-20">
        <button
          type="button"
          onClick={() => setLangOpen((v) => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface/60 backdrop-blur-md border border-border-subtle text-xs text-text-secondary hover:text-text-primary hover:bg-surface/90 transition-all duration-200 cursor-pointer"
        >
          <span className="text-sm leading-none">{currentLang.flag}</span>
          <span className="font-medium">{currentLang.code.toUpperCase()}</span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-200 ${langOpen ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {langOpen && (
          <>
            <div className="fixed inset-0" onClick={() => setLangOpen(false)} />
            <div className="absolute right-0 mt-1 min-w-[140px] rounded-lg bg-surface border border-border-subtle shadow-xl overflow-hidden animate-fade-slide-up">
              {LANGS.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    i18n.changeLanguage(lang.code);
                    setLangOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors cursor-pointer ${
                    lang.code === i18n.language
                      ? "text-primary bg-primary/8"
                      : "text-text-secondary hover:text-text-primary hover:bg-white/5"
                  }`}
                >
                  <span className="text-sm">{lang.flag}</span>
                  <span className="font-medium">{lang.label}</span>
                  {lang.code === i18n.language && (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="ml-auto text-primary"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 auth-stagger-in">
        {/* Mascot + Brand */}
        <div
          className="flex flex-col items-center gap-3 auth-stagger-item"
          style={{ "--stagger": 0 } as React.CSSProperties}
        >
          <Mascot className="w-16 h-16 auth-mascot-bounce" />
          <h1 className="font-display text-[2rem] font-extrabold tracking-[-0.03em] text-text-primary">
            Spr<span className="text-primary"></span>va
          </h1>
        </div>

        {/* Card */}
        <div
          ref={cardRef}
          className="relative w-[440px] auth-stagger-item"
          style={
            {
              "--stagger": 1,
              perspective: "800px",
            } as React.CSSProperties
          }
        >
          <div
            className="relative rounded-2xl border border-border-subtle bg-surface/80 backdrop-blur-xl p-8 shadow-[0_8px_40px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.02)_inset] transition-transform duration-300 ease-out"
            style={{
              transform: `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`,
            }}
          >
            {/* Glare highlight */}
            <div
              className="absolute inset-0 rounded-2xl pointer-events-none opacity-[0.04] transition-opacity duration-300"
              style={{
                background: `radial-gradient(circle at ${glareX}% ${glareY}%, white, transparent 60%)`,
              }}
            />
            {/* Top accent line */}
            <div className="absolute top-0 left-8 right-8 h-[2px] rounded-full overflow-hidden">
              <div
                className="h-full w-full"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, var(--color-primary), var(--color-accent), transparent)",
                  animation: "auth-shimmer 3s ease-in-out infinite",
                }}
              />
            </div>
            <div className="relative z-10">{children}</div>
          </div>
        </div>

        {/* Footer tagline */}
        <p
          className="text-[11px] text-text-muted tracking-widest uppercase font-mono auth-stagger-item"
          style={{ "--stagger": 2 } as React.CSSProperties}
        >
          Talk freely
        </p>
      </div>
    </div>
  );
}
