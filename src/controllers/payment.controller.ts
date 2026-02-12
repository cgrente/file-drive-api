import type { Request, Response } from "express";
import stripeService from "../services/stripe.service";

/**
 * Create a payment intent
 * @route POST /api/payment/intent
 */
export const createPaymentIntent = async (req: Request, res: Response) => {
  try {
    const { amount, currency } = req.body;

    if (typeof amount !== "number" || !currency || typeof currency !== "string") {
      return res.status(400).json({ error: "amount (number) and currency (string) are required." });
    }

    const clientSecret = await stripeService.createPaymentIntent(amount, currency);
    return res.status(200).json({ clientSecret });
  } catch (error: any) {
    console.error("Error creating payment intent:", error?.message ?? error);
    return res.status(500).json({ error: "Failed to create payment intent." });
  }
};

/**
 * Handle Stripe webhook events
 * @route POST /api/payment/webhook
 */
export const handleWebhook = async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"];

  if (!sig || Array.isArray(sig)) {
    return res.status(400).send("Webhook Error: Invalid signature header");
  }

  try {
    // ✅ req.body is a Buffer because of express.raw() on that route
    await stripeService.handleWebhook(req.body as Buffer, sig);
    return res.json({ received: true });
  } catch (error: any) {
    console.error("Webhook Error:", error?.message ?? error);
    return res.status(400).send(`Webhook Error: ${error?.message ?? "Unknown error"}`);
  }
};