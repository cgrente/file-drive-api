import { Types } from "mongoose";
import Stripe from "stripe";

import { Subscription, type ISubscription } from "../models/subscription.model";
import { User } from "../models/user.model";
import StripeService from "./stripe.service";
import { AppError } from "../errors/app.errors";
import { requireEnv } from "../config/env";
import { getClients } from "../infra/clients";
import type { IStripeSubscription } from "../interfaces/stripe/IStripeSubscription";

type PlanType = "monthly" | "yearly";

class SubscriptionService {
  private stripe(): Stripe {
    return getClients().stripe;
  }

  private priceIdForPlan(planType: PlanType): string {
    const nodeEnv = process.env.NODE_ENV ?? "production";
    const isProd = nodeEnv === "production";

    const monthly = isProd
      ? requireEnv("STRIPE_MONTHLY_PRICE_ID")
      : requireEnv("STRIPE_MONTHLY_PRICE_ID_TEST");

    const yearly = isProd
      ? requireEnv("STRIPE_YEARLY_PRICE_ID")
      : requireEnv("STRIPE_YEARLY_PRICE_ID_TEST");

    return planType === "monthly" ? monthly : yearly;
  }

  async getAllSubscriptions(): Promise<ISubscription[]> {
    try {
      return await Subscription.find().sort({ createdAt: -1 });
    } catch (cause) {
      throw new AppError({
        message: "Failed to fetch subscriptions",
        statusCode: 500,
        code: "SUBSCRIPTION_FETCH_FAILED",
        cause,
      });
    }
  }

  async getSubscriptionById(id: string): Promise<ISubscription | null> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError({
        message: "Invalid subscription id",
        statusCode: 400,
        code: "SUBSCRIPTION_INVALID_ID",
        details: { id },
      });
    }

    try {
      return await Subscription.findById(id);
    } catch (cause) {
      throw new AppError({
        message: "Failed to fetch subscription",
        statusCode: 500,
        code: "SUBSCRIPTION_FETCH_FAILED",
        cause,
      });
    }
  }

  async getMostRecentActiveSubscription(userId: string): Promise<ISubscription | null> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new AppError({
        message: "Invalid userId",
        statusCode: 400,
        code: "USER_INVALID_ID",
        details: { userId },
      });
    }

    try {
      return await Subscription.findOne({
        userId: new Types.ObjectId(userId),
        status: "active",
      })
        .sort({ startedAt: -1 })
        .exec();
    } catch (cause) {
      throw new AppError({
        message: "Failed to fetch active subscription",
        statusCode: 500,
        code: "SUBSCRIPTION_FETCH_FAILED",
        cause,
      });
    }
  }

  /**
   * Stripe customer creation (delegates to StripeService).
   * Throws if customer already exists for that email (as your StripeService does).
   */
  async createStripeCustomer(email: string, name: string): Promise<Stripe.Customer> {
    try {
      return await StripeService.createCustomer(email, name);
    } catch (cause) {
      throw new AppError({
        message: "Failed to create Stripe customer",
        statusCode: 400,
        code: "STRIPE_CUSTOMER_CREATE_FAILED",
        cause,
      });
    }
  }

  async attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    try {
      const pm = await StripeService.attachPaymentMethod(customerId, paymentMethodId);
      await StripeService.setDefaultPaymentMethod(customerId, paymentMethodId);
      return pm;
    } catch (cause) {
      throw new AppError({
        message: "Failed to attach payment method",
        statusCode: 500,
        code: "STRIPE_PAYMENT_METHOD_ATTACH_FAILED",
        cause,
      });
    }
  }

  async createStripeSubscription(input: {
    stripeCustomerId: string;
    planType: PlanType;
    paymentMethodId: string;
  }): Promise<IStripeSubscription> {
    const priceId = this.priceIdForPlan(input.planType);

    try {
      return await StripeService.createSubscription(input.stripeCustomerId, priceId, input.paymentMethodId);
    } catch (cause) {
      throw new AppError({
        message: "Failed to create Stripe subscription",
        statusCode: 500,
        code: "STRIPE_SUBSCRIPTION_CREATE_FAILED",
        cause,
      });
    }
  }

  /**
   * Updates default payment method:
   * - attach new method
   * - set customer default
   * - set subscription default
   * - detach old method (if different)
   */
  async updatePaymentMethod(customerId: string, paymentMethodId: string, subscriptionId: string): Promise<{ message: string }> {
    try {
      const customer = await this.stripe().customers.retrieve(customerId);
      const oldPaymentMethodId = (customer as any)?.invoice_settings?.default_payment_method as string | undefined;

      await this.stripe().paymentMethods.attach(paymentMethodId, { customer: customerId });

      await this.stripe().customers.update(customerId, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });

      await this.stripe().subscriptions.update(subscriptionId, {
        default_payment_method: paymentMethodId,
      });

      if (oldPaymentMethodId && oldPaymentMethodId !== paymentMethodId) {
        await this.stripe().paymentMethods.detach(oldPaymentMethodId);
      }

      return { message: "Payment method updated successfully" };
    } catch (cause) {
      throw new AppError({
        message: "Failed to update payment method",
        statusCode: 500,
        code: "STRIPE_PAYMENT_METHOD_UPDATE_FAILED",
        cause,
      });
    }
  }

  async updateSubscription(id: string, subscriptionData: Partial<ISubscription>): Promise<ISubscription | null> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError({
        message: "Invalid subscription id",
        statusCode: 400,
        code: "SUBSCRIPTION_INVALID_ID",
        details: { id },
      });
    }

    try {
      return await Subscription.findByIdAndUpdate(id, subscriptionData, { new: true });
    } catch (cause) {
      throw new AppError({
        message: "Failed to update subscription",
        statusCode: 500,
        code: "SUBSCRIPTION_UPDATE_FAILED",
        cause,
      });
    }
  }

  /**
   * Persist a subscription in MongoDB.
   * This is used by the auth controller after Stripe checkout completes.
   */
  async saveSubscription(subscriptionData: Partial<ISubscription>): Promise<ISubscription> {
    try {
      const sub = new Subscription(subscriptionData);
      return await sub.save();
    } catch (cause) {
      throw new AppError({
        message: "Failed to save subscription",
        statusCode: 500,
        code: "SUBSCRIPTION_CREATE_FAILED",
        cause,
      });
    }
  }

  /**
   * Cancel by USER ID (your current behavior), cancels Stripe subscription and updates DB.
   * (If you prefer cancel by subscriptionId instead, tell me and I’ll flip the route/controller/service cleanly.)
   */
  async cancelSubscriptionByUserId(userId: string): Promise<{
    stripeSubscriptionId: string;
    status: string;
    canceledAt: number | null;
    endsAt: number | null;
  }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new AppError({
        message: "Invalid userId",
        statusCode: 400,
        code: "USER_INVALID_ID",
        details: { userId },
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError({
        message: "User not found",
        statusCode: 404,
        code: "USER_NOT_FOUND",
      });
    }

    const subscription = await Subscription.findOne({ userId: new Types.ObjectId(userId), status: "active" }).sort({ startedAt: -1 });
    if (!subscription) {
      throw new AppError({
        message: "No active subscription found for this user",
        statusCode: 404,
        code: "SUBSCRIPTION_NOT_FOUND",
      });
    }

    try {
      const canceled = await this.stripe().subscriptions.cancel(subscription.stripeSubscriptionId);

      subscription.status = "canceled";
      subscription.cancellationAt = new Date();
      subscription.cancellationReason = "User requested cancellation";
      await subscription.save();

      (user as any).subscriptionId = undefined;
      await user.save();

      return {
        stripeSubscriptionId: canceled.id,
        status: canceled.status,
        canceledAt: canceled.canceled_at ?? null,
        endsAt: canceled.current_period_end ?? null,
      };
    } catch (cause) {
      throw new AppError({
        message: "Failed to cancel subscription",
        statusCode: 500,
        code: "STRIPE_SUBSCRIPTION_CANCEL_FAILED",
        cause,
      });
    }
  }

  async getCustomerInvoices(customerId: string): Promise<
    Array<{
      id: string;
      amount: number;
      status: string | null;
      currency: string;
      pdfUrl: string | null;
      hostedUrl: string | null;
      created: Date;
    }>
  > {
    try {
      const invoices = await this.stripe().invoices.list({
        customer: customerId,
        limit: 12,
      });

      return invoices.data.map((inv) => ({
        id: inv.id,
        amount: inv.amount_due,
        status: inv.status ?? null,
        currency: inv.currency,
        pdfUrl: inv.invoice_pdf ?? null,
        hostedUrl: inv.hosted_invoice_url ?? null,
        created: new Date(inv.created * 1000),
      }));
    } catch (cause) {
      throw new AppError({
        message: "Failed to fetch invoices",
        statusCode: 500,
        code: "STRIPE_INVOICES_FETCH_FAILED",
        cause,
      });
    }
  }
}

export default new SubscriptionService();