import { create } from "zustand";

export type DeepLinkAction =
  | { type: "emailVerified" }
  | { type: "invite"; code: string };

interface DeepLinkState {
  pendingAction: DeepLinkAction | null;
  pendingInviteCode: string | null;
  setPendingAction(action: DeepLinkAction): void;
  consumeAction(): void;
  setPendingInviteCode(code: string): void;
  clearPendingInviteCode(): void;
}

export const useDeepLinkStore = create<DeepLinkState>((set) => ({
  pendingAction: null,
  pendingInviteCode: null,

  setPendingAction(action) {
    set({ pendingAction: action });
  },

  consumeAction() {
    set({ pendingAction: null });
  },

  setPendingInviteCode(code) {
    set({ pendingInviteCode: code });
  },

  clearPendingInviteCode() {
    set({ pendingInviteCode: null });
  },
}));
