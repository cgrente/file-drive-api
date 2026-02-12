import { Router, type RequestHandler } from "express";
import { body, validationResult } from "express-validator";

import { createPaymentIntent, handleWebhook } from "../controllers/payment.controller";

const router = Router();

const handleValidationErrors: RequestHandler = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  return next();
};

/**
 * POST /api/payment/intent
 * Body: { amount: number, currency: string }
 */
router.post(
  "/intent",
  [
    body("amount").isInt({ min: 1 }).withMessage("amount must be a positive integer (cents)"),
    body("currency").isString().notEmpty().withMessage("currency is required"),
    handleValidationErrors,
  ],
  createPaymentIntent
);

/**
 * POST /api/payment/webhook
 * IMPORTANT: Must use raw body middleware when mounting this route.
 */
router.post("/webhook", handleWebhook);

export default router;