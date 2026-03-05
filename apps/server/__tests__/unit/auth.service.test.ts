/**
 * Unit tests for AuthService.
 * Covers registration, login, token refresh, logout, email verification,
 * password change, forgot/reset password flows.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthService } from "../../src/modules/auth/auth.service.js";
import { prisma } from "../../src/config/db.js";
import { makeUser, makeRefreshToken } from "../helpers/factories.js";
import { AppError } from "../../src/utils/AppError.js";

// Mock bcrypt directly so we control password comparison
vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn(async () => "$2b$12$hashed"),
    compare: vi.fn(async () => true),
  },
}));

// Mock jsonwebtoken
vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn(() => "mock-jwt-token"),
    verify: vi.fn(() => ({ userId: "user-1" })),
  },
}));

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
  });

  // ── Register ────────────────────────────────────────────────────────────────

  describe("register", () => {
    it("should create a new user and return tokens", async () => {
      const user = makeUser({ id: "new-1", email: "new@test.com", username: "newuser" });

      // No existing user with same email/username
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      // Transaction creates user, profile, settings
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          user: { create: vi.fn().mockResolvedValue(user) },
          userProfile: { create: vi.fn().mockResolvedValue({}) },
          userSettings: { create: vi.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      // Store refresh token
      vi.mocked(prisma.refreshToken.create).mockResolvedValue({} as any);
      // Verification email (fire-and-forget)
      vi.mocked(prisma.emailVerification.deleteMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.emailVerification.create).mockResolvedValue({} as any);

      const result = await service.register({
        username: "newuser",
        email: "new@test.com",
        password: "password123",
      });

      expect(result.accessToken).toBe("mock-jwt-token");
      expect(result.refreshToken).toBe("mock-jwt-token");
      expect(result.user.username).toBe("newuser");
      expect(result.user.verified).toBe(false);
    });

    it("should throw ALREADY_EXISTS if email is taken", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(
        makeUser({ email: "taken@test.com" }) as any,
      );

      await expect(
        service.register({
          username: "newuser",
          email: "taken@test.com",
          password: "password123",
        }),
      ).rejects.toThrow(AppError);
    });

    it("should throw ALREADY_EXISTS if username is taken", async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(
        makeUser({ username: "taken", email: "other@test.com" }) as any,
      );

      await expect(
        service.register({
          username: "taken",
          email: "new@test.com",
          password: "password123",
        }),
      ).rejects.toThrow(AppError);
    });
  });

  // ── Login ──────────────────────────────────────────────────────────────────

  describe("login", () => {
    it("should return tokens on valid credentials", async () => {
      const user = makeUser({ id: "user-1", verified: true });
      vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);
      vi.mocked(prisma.refreshToken.create).mockResolvedValue({} as any);
      vi.mocked(prisma.refreshToken.deleteMany).mockResolvedValue({ count: 0 });

      const result = await service.login({
        email: user.email,
        password: "password123",
      });

      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
      expect(result.user.id).toBe("user-1");
    });

    it("should throw INVALID_CREDENTIALS if user not found", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(
        service.login({ email: "unknown@test.com", password: "password123" }),
      ).rejects.toThrow("Invalid email or password");
    });

    it("should throw INVALID_CREDENTIALS if password is wrong", async () => {
      const bcrypt = await import("bcrypt");
      vi.mocked(bcrypt.default.compare).mockResolvedValueOnce(false as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(makeUser() as any);

      await expect(
        service.login({ email: "test@test.com", password: "wrong" }),
      ).rejects.toThrow("Invalid email or password");
    });
  });

  // ── Refresh ────────────────────────────────────────────────────────────────

  describe("refresh", () => {
    it("should rotate tokens on valid refresh token", async () => {
      const token = makeRefreshToken({ token: "valid-refresh" });
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        ...token,
        user: makeUser(),
      } as any);
      vi.mocked(prisma.refreshToken.delete).mockResolvedValue({} as any);
      vi.mocked(prisma.refreshToken.create).mockResolvedValue({} as any);

      const result = await service.refresh("valid-refresh");

      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { token: "valid-refresh" },
      });
    });

    it("should throw INVALID_TOKEN if refresh token not found", async () => {
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue(null);

      await expect(service.refresh("bad-token")).rejects.toThrow(
        "Invalid or expired refresh token",
      );
    });

    it("should throw INVALID_TOKEN if refresh token is expired", async () => {
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue(
        makeRefreshToken({
          expiresAt: new Date(Date.now() - 1000), // expired
        }) as any,
      );

      await expect(service.refresh("expired-token")).rejects.toThrow(
        "Invalid or expired refresh token",
      );
    });
  });

  // ── Logout ─────────────────────────────────────────────────────────────────

  describe("logout", () => {
    it("should delete the refresh token", async () => {
      vi.mocked(prisma.refreshToken.deleteMany).mockResolvedValue({ count: 1 });
      await service.logout("some-token");
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { token: "some-token" },
      });
    });
  });

  // ── Verify email ──────────────────────────────────────────────────────────

  describe("verifyEmail", () => {
    it("should mark user as verified on valid token", async () => {
      vi.mocked(prisma.emailVerification.findUnique).mockResolvedValue({
        token: "verify-token",
        userId: "user-1",
        expiresAt: new Date(Date.now() + 60_000),
      } as any);
      vi.mocked(prisma.$transaction).mockResolvedValue([{}, {}]);

      await expect(service.verifyEmail("verify-token")).resolves.toBeUndefined();
    });

    it("should throw INVALID_TOKEN on expired verification token", async () => {
      vi.mocked(prisma.emailVerification.findUnique).mockResolvedValue({
        token: "expired",
        userId: "user-1",
        expiresAt: new Date(Date.now() - 1000),
      } as any);

      await expect(service.verifyEmail("expired")).rejects.toThrow(
        "Invalid or expired verification token",
      );
    });

    it("should throw INVALID_TOKEN on missing token", async () => {
      vi.mocked(prisma.emailVerification.findUnique).mockResolvedValue(null);

      await expect(service.verifyEmail("nonexistent")).rejects.toThrow(
        "Invalid or expired verification token",
      );
    });
  });

  // ── Change password ───────────────────────────────────────────────────────

  describe("changePassword", () => {
    it("should update password hash on correct current password", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(makeUser() as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);

      await expect(
        service.changePassword("user-1", {
          currentPassword: "old",
          newPassword: "newpass123",
        }),
      ).resolves.toBeUndefined();

      expect(prisma.user.update).toHaveBeenCalled();
    });

    it("should throw INVALID_CREDENTIALS on wrong current password", async () => {
      const bcrypt = await import("bcrypt");
      vi.mocked(bcrypt.default.compare).mockResolvedValueOnce(false as never);
      vi.mocked(prisma.user.findUnique).mockResolvedValue(makeUser() as any);

      await expect(
        service.changePassword("user-1", {
          currentPassword: "wrong",
          newPassword: "newpass123",
        }),
      ).rejects.toThrow("Current password is incorrect");
    });
  });

  // ── Forgot password ───────────────────────────────────────────────────────

  describe("forgotPassword", () => {
    it("should send reset email for existing user", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(makeUser() as any);
      vi.mocked(prisma.passwordReset.deleteMany).mockResolvedValue({ count: 0 });
      vi.mocked(prisma.passwordReset.create).mockResolvedValue({} as any);

      await expect(
        service.forgotPassword({ email: "test@test.com" }),
      ).resolves.toBeUndefined();
    });

    it("should silently succeed for unknown email (no leak)", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      // Should NOT throw — prevents email enumeration
      await expect(
        service.forgotPassword({ email: "unknown@test.com" }),
      ).resolves.toBeUndefined();
    });
  });

  // ── Reset password ────────────────────────────────────────────────────────

  describe("resetPassword", () => {
    it("should update password and revoke all tokens", async () => {
      vi.mocked(prisma.passwordReset.findUnique).mockResolvedValue({
        token: "reset-token",
        userId: "user-1",
        expiresAt: new Date(Date.now() + 60_000),
      } as any);
      vi.mocked(prisma.$transaction).mockResolvedValue([{}, {}, {}]);

      await expect(
        service.resetPassword({ token: "reset-token", password: "newpass123" }),
      ).resolves.toBeUndefined();
    });

    it("should throw INVALID_TOKEN for expired reset token", async () => {
      vi.mocked(prisma.passwordReset.findUnique).mockResolvedValue({
        token: "expired",
        userId: "user-1",
        expiresAt: new Date(Date.now() - 1000),
      } as any);

      await expect(
        service.resetPassword({ token: "expired", password: "newpass123" }),
      ).rejects.toThrow("Invalid or expired reset token");
    });
  });
});
