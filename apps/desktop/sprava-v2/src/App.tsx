import { useEffect, useState } from "react";
import { useAuthStore } from "./store/auth.store";
import { listenAuthEvents } from "./lib/events";
import { Spinner } from "./components/ui/Spinner";
import { AuthLayout } from "./components/auth/AuthLayout";
import { LoginForm } from "./components/auth/LoginForm";
import { RegisterForm } from "./components/auth/RegisterForm";
import { ForgotPasswordForm } from "./components/auth/ForgotPasswordForm";
import { AppLayout } from "./components/layout/AppLayout";
import { CaptchaModal } from "./components/ui/CaptchaModal";

type AuthView = "login" | "register" | "forgot";

function App() {
  const status = useAuthStore((s) => s.status);
  const checkSession = useAuthStore((s) => s.checkSession);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [authView, setAuthView] = useState<AuthView>("login");

  useEffect(() => {
    checkSession();
    const unlisten = listenAuthEvents({
      onSessionExpired: clearAuth,
    });
    return unlisten;
  }, [checkSession, clearAuth]);

  if (status === "loading") {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-bg">
        <Spinner size="lg" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <>
        <AuthLayout>
          {authView === "login" && (
            <LoginForm
              onSwitchToRegister={() => setAuthView("register")}
              onSwitchToForgot={() => setAuthView("forgot")}
            />
          )}
          {authView === "register" && (
            <RegisterForm onSwitchToLogin={() => setAuthView("login")} />
          )}
          {authView === "forgot" && (
            <ForgotPasswordForm onSwitchToLogin={() => setAuthView("login")} />
          )}
        </AuthLayout>
        <CaptchaModal />
      </>
    );
  }

  return (
    <>
      <AppLayout />
      <CaptchaModal />
    </>
  );
}

export default App;
