import { Router, type Request, type Response, type NextFunction } from "express";
import { body, param, validationResult } from "express-validator";

import authenticate from "../middleware/auth.middleware";
import {
  getsubscription,
  getSubscriptionById,
  updateSubscription,
  attachPaymentMethod,
  cancelSubscription,
  createStripeCustomer,
  createStripeSubscription,
  getInvoices,
  getMostRecentActiveSubscription,
  updatePaymentMethod,
} from "../controllers/subscription.controller";

const router = Router();

/**
 * Centralized express-validator handler
 */
const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: "error",
      message: "Validation failed",
      errors: errors.array().map((e) => ({
        field: (e as any).path ?? "unknown",
        message: e.msg,
        location: (e as any).location ?? "body",
      })),
    });
  }
  return next();
};

/**
 * GET /api/subscription
 */
router.get("/", authenticate, getsubscription);

/**
 * GET /api/subscription/:id
 */
router.get(
  "/:id",
  authenticate,
  param("id").isMongoId().withMessage("Invalid subscription id"),
  handleValidationErrors,
  getSubscriptionById
);

/**
 * GET /api/subscription/user/:userId/recent
 */
router.get(
  "/user/:userId/recent",
  authenticate,
  param("userId").isMongoId().withMessage("Invalid userId"),
  handleValidationErrors,
  getMostRecentActiveSubscription
);

/**
 * POST /api/subscription/create-stripe-customer
 * (you can add authenticate if you want this protected)
 */
router.post(
  "/create-stripe-customer",
  body("email").isEmail().withMessage("A valid email is required"),
  body("name").isString().withMessage("Name is required"),
  handleValidationErrors,
  createStripeCustomer
);

/**
 * POST /api/subscription/attach-payment-method
 */
router.post(
  "/attach-payment-method",
  body("customerId").isString().withMessage("customerId is required"),
  body("paymentMethodId").isString().withMessage("paymentMethodId is required"),
  handleValidationErrors,
  attachPaymentMethod
);

/**
 * POST /api/subscription/create-stripe-subscription
 */
router.post(
  "/create-stripe-subscription",
  body("stripeCustomerId").isString().withMessage("stripeCustomerId is required"),
  body("planType").isIn(["monthly", "yearly"]).withMessage('planType must be "monthly" or "yearly"'),
  body("paymentMethodId").isString().withMessage("paymentMethodId is required"),
  handleValidationErrors,
  createStripeSubscription
);

/**
 * POST /api/subscription/update-payment-method
 */
router.post(
  "/update-payment-method",
  authenticate,
  body("customerId").isString().withMessage("customerId is required"),
  body("paymentMethodId").isString().withMessage("paymentMethodId is required"),
  body("subscriptionId").isString().withMessage("subscriptionId is required"),
  handleValidationErrors,
  updatePaymentMethod
);

/**
 * PUT /api/subscription/:id
 */
router.put(
  "/:id",
  authenticate,
  param("id").isMongoId().withMessage("Invalid subscription id"),
  body("userId").optional().isMongoId().withMessage("userId must be a MongoId"),
  body("stripeCustomerId").optional().isString().withMessage("stripeCustomerId must be a string"),
  body("stripeSubscriptionId").optional().isString().withMessage("stripeSubscriptionId must be a string"),
  body("status").optional().isIn(["active", "inactive", "canceled"]).withMessage("Invalid status"),
  handleValidationErrors,
  updateSubscription
);

/**
 * DELETE /api/subscription/:id
 *
 * Keeping your existing semantics: cancel by userId in body.
 * (The :id param is not used but kept to avoid breaking your frontend if it calls /:id)
 */
router.delete(
  "/:id",
  authenticate,
  param("id").isMongoId().withMessage("Invalid route id"),
  body("userId").isMongoId().withMessage("userId is required"),
  handleValidationErrors,
  cancelSubscription
);

/**
 * GET /api/subscription/invoices/:customerId
 */
router.get(
  "/invoices/:customerId",
  authenticate,
  param("customerId").isString().withMessage("Invalid customerId"),
  handleValidationErrors,
  getInvoices
);

export default router;