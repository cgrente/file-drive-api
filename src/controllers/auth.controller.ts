// src/controllers/auth.controller.ts
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

import authService from "../services/auth.service";
import userService from "../services/user.service";
import businessService from "../services/business.service";
import subscriptionService from "../services/subscription.service";
import SESService from "../services/ses.service";
import { Permission } from "../models/permission.model";
import type { IUser } from "../models/user.model";
import type { IBusiness } from "../models/business.model";
import { AppError } from "../errors/app.errors";
import { requireEnv, getEnv } from "../config/env";
import { CreateBusinessInput } from "../types/business.types";
import { Types } from "mongoose";

function isProdLikeEnv(): boolean {
  const nodeEnv = process.env.NODE_ENV ?? "production";
  return nodeEnv === "production" || nodeEnv === "beta";
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * Behavior:
 * - Sets httpOnly cookies (accessToken + refreshToken)
 * - Returns user + permissions (NO tokens in JSON)
 */
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body ?? {};

    if (typeof email !== "string" || email.trim() === "") {
      throw new AppError({ message: "email is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }
    if (typeof password !== "string" || password.trim() === "") {
      throw new AppError({ message: "password is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }

    const payload = await authService.login(email.trim(), password, res);
    return res.status(200).json(payload);
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/auth/refresh-token
 * Uses refreshToken cookie to rotate tokens and set new cookies.
 */
export const refreshAccessToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.refreshAccessToken(req, res);
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/auth/status
 * Reads accessToken cookie; should work even if missing/expired.
 */
export const checkAuthStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = (req as any).cookies?.accessToken as string | undefined;
    const payload = await authService.checkAuthStatus(token);
    return res.status(200).json(payload);
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/auth/logout
 * Clears cookies + revokes refresh token best-effort.
 */
export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.logout(req, res);
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/auth/sign-up
 * You had this route but no implementation.
 * Best practice: remove route if unused, or implement fully.
 */
export const signUp = async (_req: Request, _res: Response) => {
  return;
};

/**
 * POST /api/auth/complete-payment
 * Creates user + (optional) business + subscription + default permissions + verification email.
 */
export const createUserAndSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      name,
      email,
      password,
      businessName,
      stripeCustomerId,
      stripeSubscriptionId,
      planType,
      status,
      startedAt,
      endsAt,
    } = req.body ?? {};

    if (typeof email !== "string" || email.trim() === "") {
      throw new AppError({ message: "email is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }

    const existingUser = await userService.isUserByEmailExist(email);
    if (existingUser) {
      throw new AppError({ message: "User with this email already exists", statusCode: 400, code: "USER_EXISTS" });
    }

    // 1) Create user
    const user: IUser = await userService.createUser({
      username: name,
      email,
      password,
      stripeCustomerId,
    });

    // 2) Create business (optional)
    if (typeof businessName === "string" && businessName.trim().length > 0) {
      const businessData: CreateBusinessInput = {
        name: businessName.trim(),
        ownerId: new Types.ObjectId(user.id),
        status: "active",
      };


      const business = await businessService.createBusiness(businessData);
      user.businessId = business.id;
      await userService.updateUser(user.id, user);
    }

    // 3) Create subscription
    const prodLike = isProdLikeEnv();

    const stripeMonthlyPriceID = prodLike ? getEnv("STRIPE_MONTHLY_PRICE_ID") : getEnv("STRIPE_MONTHLY_PRICE_ID_TEST");
    const stripeYearlyPriceID = prodLike ? getEnv("STRIPE_YEARLY_PRICE_ID") : getEnv("STRIPE_YEARLY_PRICE_ID_TEST");

    await subscriptionService.saveSubscription({
      userId: user.id,
      stripeCustomerId,
      stripeSubscriptionId,
      planType,
      priceId: planType === "monthly" ? stripeMonthlyPriceID! : stripeYearlyPriceID!,
      status,
      startedAt,
      endsAt,
    });

    // 4) Default permissions
    await Permission.create({
      userId: user.id,
      accessLevel: ["read", "write", "create", "delete"],
      isGlobal: true,
    });

    // 5) Send verification email
    const exp = getEnv("EMAIL_VERIFICATION_TOKEN_EXPIRATION") ?? "1d";
    const token = jwt.sign({ userId: user.id }, requireEnv("EMAIL_VERIFICATION_SECRET"), { expiresIn: exp });

    const webappUrl = requireEnv("WEBAPP_URL");
    const emailData = SESService.generateEmailTemplate("email_verification", {
      userEmail: email,
      receiverName: name,
      verificationLink: `${webappUrl}/verify-email?token=${token}`,
    });

    await SESService.sendEmail(emailData);

    return res.status(201).json({
      message: "User and Subscription created successfully. Email verification sent",
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/auth/accept-invite
 * Body: { token, tmpPassword, newPassword }
 */
export const acceptInvite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, tmpPassword, newPassword } = req.body ?? {};
    await authService.acceptInvite(token, tmpPassword, newPassword);
    return res.status(200).json({ message: "Invitation accepted and password updated." });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/auth/verify-email
 * Body: { token }
 */
export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body ?? {};
    const message = await authService.verifyEmail(token);
    return res.status(200).json({ message });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/auth/resend-verification-email
 * Body: { userId }
 */
export const resendVerificationEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.body ?? {};
    await authService.resendVerificationEmail(userId);
    return res.status(200).json({
      message: "Verification email sent successfully. Please check your inbox.",
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 */
export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body ?? {};
    await authService.forgotPassword(email);
    return res.status(200).json({ message: "If the account exists, a reset link was sent." });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/auth/reset-password
 * Body: { token, newPassword }
 */
export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, newPassword } = req.body ?? {};
    await authService.resetPassword(token, newPassword);
    return res.status(200).json({ message: "Password has been reset successfully." });
  } catch (err) {
    return next(err);
  }
};