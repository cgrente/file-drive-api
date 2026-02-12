import Stripe from "stripe";
import { AppError } from "../errors/app.errors";
import { requireEnv } from "../config/env";
import { getClients } from "../infra/clients";
import { Subscription } from "../models/subscription.model";
import type { IStripeSubscription } from "../interfaces/stripe/IStripeSubscription";

class StripeService {
  private stripe(): Stripe {
    return getClients().stripe;
  }

  /**
   * Create a PaymentIntent
   * @param amount - amount in cents
   * @param currency - e.g. "usd"
   */
  async createPaymentIntent(amount: number, currency: string): Promise<string> {
    try {
      const paymentIntent = await this.stripe().paymentIntents.create({
        amount: Math.trunc(amount),
        currency,
        metadata: { integration_check: "accept_a_payment" },
      });

      if (!paymentIntent.client_secret) {
        throw new AppError({
          message: "Stripe did not return a client_secret",
          statusCode: 500,
          code: "STRIPE_NO_CLIENT_SECRET",
        });
      }

      return paymentIntent.client_secret;
    } catch (cause) {
      throw new AppError({
        message: "Failed to create payment intent",
        statusCode: 500,
        code: "STRIPE_PAYMENT_INTENT_FAILED",
        cause,
      });
    }
  }

  /**
   * Handle Stripe webhook events (signature verified).
   * @param payload - raw body Buffer
   * @param signature - stripe-signature header string
   */
  async handleWebhook(payload: Buffer, signature: string): Promise<void> {
    const webhookSecret = requireEnv("STRIPE_WEBHOOK_SECRET");

    let event: Stripe.Event;

    try {
      event = this.stripe().webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (cause) {
      throw new AppError({
        message: "Webhook signature verification failed",
        statusCode: 400,
        code: "STRIPE_WEBHOOK_VERIFY_FAILED",
        cause,
      });
    }

    try {
      switch (event.type) {
        case "payment_intent.succeeded": {
          const pi = event.data.object as Stripe.PaymentIntent;
          // TODO: update DB if you track one-off payments
          // console.log(`PaymentIntent succeeded: ${pi.id}`);
          break;
        }

        case "payment_intent.payment_failed": {
          const pi = event.data.object as Stripe.PaymentIntent;
          // TODO: mark failed
          // console.warn(`PaymentIntent failed: ${pi.id}`);
          break;
        }

        default: {
          // console.log(`Unhandled Stripe event type: ${event.type}`);
          break;
        }
      }
    } catch (cause) {
      throw new AppError({
        message: "Webhook processing failed",
        statusCode: 500,
        code: "STRIPE_WEBHOOK_PROCESSING_FAILED",
        cause,
      });
    }
  }

  /**
   * Find a customer by email (avoid duplicates)
   */
  async findCustomerByEmail(email: string): Promise<Stripe.Customer | null> {
    const customers = await this.stripe().customers.list({ email, limit: 1 });
    return customers.data.length > 0 ? customers.data[0] : null;
  }

  /**
   * Create a new customer (error if already exists)
   */
  async createCustomer(email: string, name: string): Promise<Stripe.Customer> {
    const existing = await this.findCustomerByEmail(email);
    if (existing) {
      throw new AppError({
        message: "Customer already exists with this email",
        statusCode: 400,
        code: "STRIPE_CUSTOMER_EXISTS",
      });
    }

    return await this.stripe().customers.create({ email, name });
  }

  async attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    return await this.stripe().paymentMethods.attach(paymentMethodId, { customer: customerId });
  }

  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    await this.stripe().customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
  }

  async createSubscription(customerId: string, priceId: string, paymentMethodId: string): Promise<IStripeSubscription> {
    const subscription = await this.stripe().subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      default_payment_method: paymentMethodId,
      expand: ["latest_invoice.payment_intent"],
    });

    const latestInvoice = subscription.latest_invoice as Stripe.Invoice;

    let clientSecret: string | null = null;
    let paymentIntentStatus: string | null = null;

    if (latestInvoice?.payment_intent && typeof latestInvoice.payment_intent !== "string") {
      clientSecret = latestInvoice.payment_intent.client_secret || null;
      paymentIntentStatus = latestInvoice.payment_intent.status || null;
    }

    return {
      id: subscription.id,
      status: subscription.status,
      clientSecret,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      paymentIntentStatus,
    };
  }

  async cancelSubscription(subscriptionId: string, cancellationReason = ""): Promise<Stripe.Subscription> {
    const canceled = await this.stripe().subscriptions.cancel(subscriptionId);

    await Subscription.findOneAndUpdate(
      { stripeSubscriptionId: subscriptionId },
      {
        status: "canceled",
        cancellationAt: new Date(),
        cancellationReason,
      }
    );

    return canceled;
  }
}

export default new StripeService();