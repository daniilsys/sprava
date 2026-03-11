import { create } from "zustand";
import { api } from "../lib/api";
import type { User } from "../types/models";

interface AuthState {
  status: "loading" | "unauthenticated" | "authenticated";
  user: User | null;
  login(email: string, password: string, captcha: string): Promise<void>;
  register(
    username: string,
    email: string,
    password: string,
    captcha: string,
    language: string,
  ): Promise<void>;
  logout(): Promise<void>;
  checkSession(): Promise<void>;
  setUser(user: User): void;
  clearAuth(): void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: "loading",
  user: null,

  async checkSession() {
    try {
      const hasSession = await api.token.hasSession();
      if (!hasSession) {
        set({ status: "unauthenticated" });
        return;
      }
      // Make a real API call to validate/refresh the token
      const user = (await api.users.getMe()) as User;
      set({ user, status: "authenticated" });
    } catch {
      set({ status: "unauthenticated" });
    }
  },

  async login(email, password, captcha) {
    const user = (await api.auth.login({
      email,
      password,
      "h-captcha-response": captcha,
    })) as User;
    set({ user, status: "authenticated" });
  },

  async register(username, email, password, captcha, language) {
    const user = (await api.auth.register({
      username,
      email,
      password,
      language,
      "h-captcha-response": captcha,
    })) as User;
    set({ user, status: "authenticated" });
  },

  async logout() {
    try {
      await api.auth.logout();
    } finally {
      set({ user: null, status: "unauthenticated" });
    }
  },

  setUser(user) {
    set({ user });
  },

  clearAuth() {
    set({ user: null, status: "unauthenticated" });
  },
}));
