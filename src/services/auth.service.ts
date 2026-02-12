// src/services/auth.service.ts
import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { Types } from "mongoose";

import { User } from "../models/user.model";
import { Permission } from "../models/permission.model";
import { AppError } from "../errors/app.errors";
import { generateAccessToken, generateRefreshToken } from "../utils/auth.utils";
import { requireEnv, getEnv } from "../config/env";
import sesService from "./ses.service";

/**
 * Auth response returned by login.
 * NOTE: No tokens are returned in JSON — tokens are stored in httpOnly cookies.
 */
export type AuthResponse = {
  user: {
    id: string;
    businessId: string;
    username: string;
    email: string;
    isEmailVerified: boolean;
    role: string;
    stripeCustomerId?: string;
    createdAt: Date;
    updatedAt: Date;
  };
  permission: Record<string, string[]>;
};

function isProdLikeEnv(): boolean {
  const nodeEnv = process.env.NODE_ENV ?? "production";
  return nodeEnv === "production" || nodeEnv === "beta";
}

/**
 * Cookie policy for access token.
 * - prod/beta: secure + SameSite=None (required for cross-site cookies)
 * - local/dev: secure=false + SameSite=Lax
 */
function getAccessCookieOptions() {
  const prodLike = isProdLikeEnv();
  return {
    httpOnly: true,
    secure: prodLike,
    sameSite: (prodLike ? "none" : "lax") as "none" | "lax",
    maxAge: 15 * 60 * 1000, // 15 minutes
    path: "/",
  };
}

/**
 * Cookie policy for refresh token.
 * We scope it to /api/auth to reduce where browsers send it.
 */
function getRefreshCookieOptions() {
  const prodLike = isProdLikeEnv();
  return {
    httpOnly: true,
    secure: prodLike,
    sameSite: (prodLike ? "none" : "lax") as "none" | "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/api/auth",
  };
}

class AuthService {
  /**
   * Login:
   * - validates credentials
   * - sets httpOnly cookies (access + refresh)
   * - returns user + permissions (NO TOKENS in JSON)
   */
  async login(email: string, password: string, res: Response): Promise<AuthResponse> {
    const user = await User.findOne({ email }).select("+password +refreshToken");
    if (!user) {
      throw new AppError({ message: "Invalid email or password", statusCode: 401, code: "AUTH_INVALID" });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      throw new AppError({ message: "Invalid email or password", statusCode: 401, code: "AUTH_INVALID" });
    }

    // Fetch permissions for the user
    const permissions = await Permission.find({ userId: user._id });
    const formattedPermissions = permissions.reduce((acc, perm) => {
      const key = perm.isGlobal ? "global" : `${perm.targetType}-${perm.targetId}`;
      acc[key] = perm.accessLevel;
      return acc;
    }, {} as Record<string, string[]>);

    // Create tokens
    const accessToken = generateAccessToken(user.id.toString());
    const refreshToken = generateRefreshToken(user.id.toString());

    // Persist refresh token (simple "single session" model)
    user.refreshToken = refreshToken;
    await user.save();

    // Set cookies
    res.cookie("accessToken", accessToken, getAccessCookieOptions());
    res.cookie("refreshToken", refreshToken, getRefreshCookieOptions());

    return {
      user: {
        id: user.id.toString(),
        businessId: user.businessId?.toString() || "",
        username: user.username,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
        role: user.role,
        stripeCustomerId: user.stripeCustomerId || "",
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      permission: formattedPermissions,
    };
  }

  /**
   * Refresh access token:
   * - reads refreshToken cookie
   * - verifies signature
   * - checks refresh token matches DB (prevents replay after logout/rotation)
   * - rotates refresh token
   */
  async refreshAccessToken(req: Request, res: Response): Promise<void> {
    const token = (req as any).cookies?.refreshToken as string | undefined;
    if (!token) {
      throw new AppError({ message: "No refresh token provided", statusCode: 401, code: "NO_REFRESH_TOKEN" });
    }

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, requireEnv("REFRESH_TOKEN_SECRET")) as JwtPayload;
    } catch {
      throw new AppError({ message: "Invalid refresh token", statusCode: 401, code: "BAD_REFRESH_TOKEN" });
    }

    const userId = decoded?.userId as string | undefined;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new AppError({ message: "Invalid refresh token", statusCode: 401, code: "BAD_REFRESH_TOKEN" });
    }

    const user = await User.findById(userId).select("+refreshToken");
    if (!user || user.refreshToken !== token) {
      throw new AppError({ message: "Invalid refresh token", statusCode: 401, code: "BAD_REFRESH_TOKEN" });
    }

    const newAccessToken = generateAccessToken(user.id.toString());
    const newRefreshToken = generateRefreshToken(user.id.toString());

    // Rotate refresh token
    user.refreshToken = newRefreshToken;
    await user.save();

    res.cookie("accessToken", newAccessToken, getAccessCookieOptions());
    res.cookie("refreshToken", newRefreshToken, getRefreshCookieOptions());

    res.status(200).json({ message: "ok" });
  }

  /**
   * Auth status:
   * - checks access token cookie validity
   * - returns minimal user payload (no sensitive fields)
   */
  async checkAuthStatus(token: string | undefined): Promise<{ isAuthenticated: boolean; user?: unknown }> {
    if (!token) return { isAuthenticated: false };

    try {
      const decoded = jwt.verify(token, requireEnv("ACCESS_TOKEN_SECRET")) as JwtPayload;

      const userId = decoded?.userId as string | undefined;
      if (!userId || !Types.ObjectId.isValid(userId)) return { isAuthenticated: false };

      const user = await User.findById(userId).select("-password");
      if (!user) return { isAuthenticated: false };

      return {
        isAuthenticated: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          businessId: user.businessId || null,
          isEmailVerified: user.isEmailVerified,
        },
      };
    } catch {
      return { isAuthenticated: false };
    }
  }

  /**
   * Logout:
   * - clears cookies
   * - clears refresh token in DB (recommended)
   */
  async logout(req: Request, res: Response): Promise<void> {
    const refreshToken = (req as any).cookies?.refreshToken as string | undefined;

    if (refreshToken) {
      // Best-effort revoke
      const user = await User.findOne({ refreshToken }).select("+refreshToken");
      if (user) {
        user.refreshToken = undefined;
        await user.save();
      }
    }

    // Clear cookies using the same paths used when setting them
    res.clearCookie("accessToken", { path: "/" });
    res.clearCookie("refreshToken", { path: "/api/auth" });

    res.status(200).json({ message: "Logged out successfully" });
  }

  /**
   * Accept invite:
   * - verifies invitation token
   * - checks temporary password
   * - sets the new password + marks email verified
   * - ensures a default global permission exists
   */
  async acceptInvite(token: string, tmpPassword: string, newPassword: string): Promise<void> {
    if (!token || !tmpPassword || !newPassword) {
      throw new AppError({ message: "Missing required fields", statusCode: 400, code: "VALIDATION_ERROR" });
    }

    const decoded = jwt.verify(token, requireEnv("INVITATION_SECRET")) as {
      email: string;
      userId: string;
      businessId: string;
    };

    if (!decoded?.userId || !Types.ObjectId.isValid(decoded.userId)) {
      throw new AppError({ message: "Invalid invitation token", statusCode: 400, code: "BAD_INVITE_TOKEN" });
    }

    const user = await User.findById(decoded.userId).select("+password");
    if (!user) {
      throw new AppError({ message: "User not found", statusCode: 404, code: "USER_NOT_FOUND" });
    }

    // You already have user.comparePassword in your model — keep using it.
    const ok = await (user as any).comparePassword(tmpPassword);
    if (!ok) {
      throw new AppError({ message: "Temporary password is incorrect", statusCode: 401, code: "BAD_TEMP_PASSWORD" });
    }

    user.password = newPassword;
    user.isEmailVerified = true;
    await user.save();

    // Ensure default global read permission exists
    const existingPermissions = await Permission.find({ userId: user._id });
    if (!existingPermissions.some((perm) => perm.isGlobal)) {
      await Permission.create({
        userId: user._id,
        accessLevel: ["read"],
        isGlobal: true,
      });
    }
  }

  /**
   * Forgot password:
   * - generates a reset token
   * - stores it + expiry in DB
   * - sends email via SES service
   */
  async forgotPassword(email: string): Promise<void> {
    if (!email) {
      throw new AppError({ message: "email is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Security: don't reveal whether the email exists (optional).
      // If you prefer your old behavior, change to 404/400.
      return;
    }

    const secret = requireEnv("PASSWORD_RESET_SECRET");
    const expiresIn = getEnv("PASSWORD_RESET_EXPIRATION") ?? "1h";

    const resetToken = jwt.sign({ userId: user.id, email: user.email }, secret, { expiresIn });

    user.resetPasswordToken = resetToken;
    user.resetPasswordTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const webappUrl = requireEnv("WEBAPP_URL");
    const resetLink = `${webappUrl}/reset-password?token=${resetToken}`;

    const emailData = sesService.generateEmailTemplate("password_reset", {
      userEmail: user.email,
      resetLink,
    });

    await sesService.sendEmail(emailData);
  }

  /**
   * Reset password:
   * - verifies reset token
   * - checks expiry
   * - updates password
   * - clears reset fields
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!token || !newPassword) {
      throw new AppError({ message: "token and newPassword are required", statusCode: 400, code: "VALIDATION_ERROR" });
    }

    const decoded = jwt.verify(token, requireEnv("PASSWORD_RESET_SECRET")) as { userId: string; exp: number };

    if (!decoded?.userId || !Types.ObjectId.isValid(decoded.userId)) {
      throw new AppError({ message: "Invalid or expired reset token", statusCode: 400, code: "BAD_RESET_TOKEN" });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new AppError({ message: "Invalid or expired reset token", statusCode: 400, code: "BAD_RESET_TOKEN" });
    }

    // Token exp is in seconds
    if (decoded.exp * 1000 < Date.now()) {
      throw new AppError({ message: "Reset token has expired", statusCode: 400, code: "RESET_TOKEN_EXPIRED" });
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordTokenExpires = undefined;
    await user.save();
  }

  /**
   * Verify email:
   * - verifies token
   * - marks user as verified
   */
  async verifyEmail(token: string): Promise<string> {
    if (!token) {
      throw new AppError({ message: "token is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }

    const decoded = jwt.verify(token, requireEnv("EMAIL_VERIFICATION_SECRET")) as { userId: string };

    if (!decoded?.userId || !Types.ObjectId.isValid(decoded.userId)) {
      throw new AppError({ message: "Invalid or expired token", statusCode: 400, code: "BAD_VERIFY_TOKEN" });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new AppError({ message: "User not found", statusCode: 404, code: "USER_NOT_FOUND" });
    }

    if (user.isEmailVerified) return "Email already verified";

    user.isEmailVerified = true;
    await user.save();

    return "Email verified successfully";
  }

  /**
   * Resend verification email:
   * - validates userId
   * - generates a new verification token
   * - sends email via SES service
   */
  async resendVerificationEmail(userId: string): Promise<void> {
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new AppError({ message: "userId is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError({ message: "User not found", statusCode: 404, code: "USER_NOT_FOUND" });
    }

    if (user.isEmailVerified) {
      throw new AppError({ message: "Email is already verified", statusCode: 400, code: "ALREADY_VERIFIED" });
    }

    const exp = getEnv("EMAIL_VERIFICATION_TOKEN_EXPIRATION") ?? "1d";
    const token = jwt.sign({ userId: user.id }, requireEnv("EMAIL_VERIFICATION_SECRET"), { expiresIn: exp });

    const webappUrl = requireEnv("WEBAPP_URL");
    const verificationLink = `${webappUrl}/verify-email?token=${token}`;

    const emailData = sesService.generateEmailTemplate("email_verification", {
      userEmail: user.email,
      receiverName: user.username,
      verificationLink,
    });

    await sesService.sendEmail(emailData);
  }
}

export default new AuthService();