import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";

import subscriptionService from "../services/subscription.service";
import { AppError } from "../errors/app.errors";

/**
 * GET /api/subscription
 */
export const getsubscription = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const subscriptions = await subscriptionService.getAllSubscriptions();
    return res.status(200).json(subscriptions);
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/subscription/:id
 */
export const getSubscriptionById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const subscription = await subscriptionService.getSubscriptionById(id);
    if (!subscription) {
      throw new AppError({
        message: "Subscription not found",
        statusCode: 404,
        code: "SUBSCRIPTION_NOT_FOUND",
      });
    }

    return res.status(200).json(subscription);
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/subscription/user/:userId/recent
 */
export const getMostRecentActiveSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    const subscription = await subscriptionService.getMostRecentActiveSubscription(userId);
    if (!subscription) {
      throw new AppError({
        message: "No active subscription found for this user",
        statusCode: 404,
        code: "SUBSCRIPTION_NOT_FOUND",
      });
    }

    return res.status(200).json(subscription);
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/subscription/create-stripe-customer
 * Body: { email, name }
 */
export const createStripeCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, name } = req.body ?? {};

    if (typeof email !== "string" || email.trim() === "") {
      throw new AppError({ message: "email is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }
    if (typeof name !== "string" || name.trim() === "") {
      throw new AppError({ message: "name is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }

    const customer = await subscriptionService.createStripeCustomer(email.trim(), name.trim());
    return res.status(200).json({ stripeCustomerId: customer.id });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/subscription/attach-payment-method
 * Body: { customerId, paymentMethodId }
 */
export const attachPaymentMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId, paymentMethodId } = req.body ?? {};

    if (typeof customerId !== "string" || customerId.trim() === "") {
      throw new AppError({ message: "customerId is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }
    if (typeof paymentMethodId !== "string" || paymentMethodId.trim() === "") {
      throw new AppError({ message: "paymentMethodId is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }

    const paymentMethod = await subscriptionService.attachPaymentMethod(customerId.trim(), paymentMethodId.trim());
    return res.status(200).json({ paymentMethod });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/subscription/create-stripe-subscription
 * Body: { stripeCustomerId, planType: "monthly"|"yearly", paymentMethodId }
 */
export const createStripeSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stripeCustomerId, planType, paymentMethodId } = req.body ?? {};

    if (typeof stripeCustomerId !== "string" || stripeCustomerId.trim() === "") {
      throw new AppError({ message: "stripeCustomerId is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }
    if (planType !== "monthly" && planType !== "yearly") {
      throw new AppError({ message: 'planType must be "monthly" or "yearly"', statusCode: 400, code: "VALIDATION_ERROR" });
    }
    if (typeof paymentMethodId !== "string" || paymentMethodId.trim() === "") {
      throw new AppError({ message: "paymentMethodId is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }

    const subscription = await subscriptionService.createStripeSubscription({
      stripeCustomerId: stripeCustomerId.trim(),
      planType,
      paymentMethodId: paymentMethodId.trim(),
    });

    return res.status(201).json(subscription);
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/subscription/update-payment-method
 * Body: { customerId, paymentMethodId, subscriptionId }
 */
export const updatePaymentMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId, paymentMethodId, subscriptionId } = req.body ?? {};

    if (typeof customerId !== "string" || customerId.trim() === "") {
      throw new AppError({ message: "customerId is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }
    if (typeof paymentMethodId !== "string" || paymentMethodId.trim() === "") {
      throw new AppError({ message: "paymentMethodId is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }
    if (typeof subscriptionId !== "string" || subscriptionId.trim() === "") {
      throw new AppError({ message: "subscriptionId is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }

    const result = await subscriptionService.updatePaymentMethod(customerId.trim(), paymentMethodId.trim(), subscriptionId.trim());
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
};

/**
 * PUT /api/subscription/:id
 */
export const updateSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const updated = await subscriptionService.updateSubscription(id, req.body ?? {});
    if (!updated) {
      throw new AppError({
        message: "Subscription not found",
        statusCode: 404,
        code: "SUBSCRIPTION_NOT_FOUND",
      });
    }

    return res.status(200).json(updated);
  } catch (err) {
    return next(err);
  }
};

/**
 * DELETE /api/subscription/:id
 *
 * Your existing cancel flow cancels by userId — so we keep it:
 * Body: { userId }
 */
export const cancelSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.body ?? {};

    if (!userId || typeof userId !== "string" || !Types.ObjectId.isValid(userId)) {
      throw new AppError({ message: "userId is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }

    const result = await subscriptionService.cancelSubscriptionByUserId(userId);
    return res.status(200).json({ message: "Subscription canceled successfully", result });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/subscription/invoices/:customerId
 */
export const getInvoices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId } = req.params;

    if (!customerId || typeof customerId !== "string") {
      throw new AppError({ message: "customerId is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }

    const invoices = await subscriptionService.getCustomerInvoices(customerId);
    return res.status(200).json(invoices);
  } catch (err) {
    return next(err);
  }
};