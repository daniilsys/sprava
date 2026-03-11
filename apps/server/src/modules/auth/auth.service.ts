import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { prisma } from "../../config/db.js";
import {
  RegisterDto,
  LoginDto,
  ChangePasswordDto,
  ChangeEmailDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from "./auth.schema.js";
import { AppError } from "../../utils/AppError.js";
import { generateId } from "../../utils/snowflake.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from "../../config/email.js";
import { logger } from "../../config/logger.js";

const ACCESS_SECRET = process.env.JWT_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

const generateTokens = (userId: string) => {
  const accessToken = jwt.sign({ userId }, ACCESS_SECRET, { expiresIn: "15m" });
  const refreshToken = jwt.sign({ userId }, REFRESH_SECRET, {
    expiresIn: "7d",
  });
  return { accessToken, refreshToken };
};

export class AuthService {
  async register(dto: RegisterDto) {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    if (existing?.email === dto.email)
      throw new AppError(
        "User with this email already exists",
        400,
        "ALREADY_EXISTS",
      );
    if (existing?.username === dto.username)
      throw new AppError(
        "User with this username already exists",
        400,
        "ALREADY_EXISTS",
      );

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          id: generateId(),
          username: dto.username,
          email: dto.email,
          passwordHash,
        },
      });
      await tx.userProfile.create({ data: { userId: newUser.id } });
      await tx.userSettings.create({ data: { userId: newUser.id, language: dto.language } });
      return newUser;
    });

    const { accessToken, refreshToken } = generateTokens(user.id);
    await prisma.refreshToken.create({
      data: {
        id: generateId(),
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    this.sendVerification(user.id, user.email).catch((e) => {
      logger.error({ err: e, userId: user.id }, "Failed to send verification email");
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        verified: false,
      },
    };
  }

  private async sendVerification(userId: string, email: string): Promise<void> {
    // Invalidate any previous token for this user
    await prisma.emailVerification.deleteMany({ where: { userId } });

    const token = randomBytes(32).toString("hex");
    await prisma.emailVerification.create({
      data: {
        id: generateId(),
        userId,
        token,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      },
    });

    await sendVerificationEmail(email, token);
  }

  async login(dto: LoginDto) {
    const user = await prisma.user.findUnique({ where: { email: dto.email } });
    if (!user)
      throw new AppError(
        "Invalid email or password",
        400,
        "INVALID_CREDENTIALS",
      );

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid)
      throw new AppError(
        "Invalid email or password",
        400,
        "INVALID_CREDENTIALS",
      );

    const { accessToken, refreshToken } = generateTokens(user.id);

    await prisma.refreshToken.create({
      data: {
        id: generateId(),
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    this.deleteAllTokensForUser(user.id).catch(() => {});

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        verified: user.verified,
      },
    };
  }

  async verifyEmail(token: string): Promise<void> {
    const record = await prisma.emailVerification.findUnique({
      where: { token },
    });
    if (!record || record.expiresAt < new Date()) {
      throw new AppError(
        "Invalid or expired verification token",
        400,
        "INVALID_TOKEN",
      );
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { verified: true },
      }),
      prisma.emailVerification.deleteMany({ where: { userId: record.userId } }),
    ]);
  }

  async resendVerification(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError("User not found", 404, "NOT_FOUND");
    if (user.verified)
      throw new AppError("Email already verified", 400, "ALREADY_VERIFIED");

    await this.sendVerification(userId, user.email);
  }

  async refresh(token: string) {
    const stored = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });
    if (!stored || stored.expiresAt < new Date())
      throw new AppError(
        "Invalid or expired refresh token",
        401,
        "INVALID_TOKEN",
      );

    const payload = jwt.verify(token, REFRESH_SECRET) as { userId: string };

    await prisma.refreshToken.delete({ where: { token } });

    const { accessToken, refreshToken } = generateTokens(payload.userId);
    await prisma.refreshToken.create({
      data: {
        id: generateId(),
        userId: payload.userId,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return { accessToken, refreshToken };
  }

  async logout(token: string) {
    await prisma.refreshToken.deleteMany({ where: { token } });
  }

  async changeEmail(userId: string, dto: ChangeEmailDto): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError("User not found", 404, "NOT_FOUND");

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid)
      throw new AppError(
        "Invalid password",
        400,
        "INVALID_CREDENTIALS",
      );

    if (dto.newEmail === user.email)
      throw new AppError(
        "New email must be different from current email",
        400,
        "SAME_EMAIL",
      );

    const existing = await prisma.user.findUnique({ where: { email: dto.newEmail } });
    if (existing)
      throw new AppError(
        "This email is already in use",
        400,
        "ALREADY_EXISTS",
      );

    await prisma.user.update({
      where: { id: userId },
      data: { email: dto.newEmail, verified: false },
    });

    this.sendVerification(userId, dto.newEmail).catch((e) => {
      logger.error({ err: e, userId }, "Failed to send verification email after email change");
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError("User not found", 404, "NOT_FOUND");

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid)
      throw new AppError(
        "Current password is incorrect",
        400,
        "INVALID_CREDENTIALS",
      );

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email: dto.email } });

    // Always return silently — do not reveal whether the email exists
    if (!user) return;

    // Invalidate any existing reset token for this user
    await prisma.passwordReset.deleteMany({ where: { userId: user.id } });

    const token = randomBytes(32).toString("hex");
    await prisma.passwordReset.create({
      data: {
        id: generateId(),
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    await sendPasswordResetEmail(user.email, token);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const record = await prisma.passwordReset.findUnique({
      where: { token: dto.token },
    });

    if (!record || record.expiresAt < new Date()) {
      throw new AppError(
        "Invalid or expired reset token",
        400,
        "INVALID_TOKEN",
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      // Invalidate the used token
      prisma.passwordReset.deleteMany({ where: { userId: record.userId } }),
      // Force logout everywhere — all refresh tokens are revoked
      prisma.refreshToken.deleteMany({ where: { userId: record.userId } }),
    ]);
  }

  private async deleteAllTokensForUser(userId: string) {
    await prisma.refreshToken.deleteMany({
      where: { userId, expiresAt: { lt: new Date() } },
    });
  }
}
