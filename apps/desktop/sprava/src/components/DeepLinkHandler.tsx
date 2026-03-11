import { useEffect } from "react";
import { useDeepLinkStore } from "../store/deeplink.store";
import { useAuthStore } from "../store/auth.store";
import { useUIStore } from "../store/ui.store";
import { api } from "../lib/api";

export function DeepLinkHandler() {
  const pendingAction = useDeepLinkStore((s) => s.pendingAction);
  const consumeAction = useDeepLinkStore((s) => s.consumeAction);
  const status = useAuthStore((s) => s.status);
  const setUser = useAuthStore((s) => s.setUser);

  useEffect(() => {
    if (!pendingAction || status !== "authenticated") return;

    if (pendingAction.type === "emailVerified") {
      api.users.getMe().then((user) => {
        setUser(user as Parameters<typeof setUser>[0]);
      });
    }

    if (pendingAction.type === "invite") {
      useDeepLinkStore.getState().setPendingInviteCode(pendingAction.code);
      useUIStore.getState().openModal("joinServer");
    }

    consumeAction();
  }, [pendingAction, status, consumeAction, setUser]);

  return null;
}
