import { Router, type RequestHandler } from "express";
import { body, validationResult } from "express-validator";

import {
  login,
  logout,
  refreshAccessToken,
  checkAuthStatus,
  signUp,
  createUserAndSubscription,
  acceptInvite,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
} from "../controllers/auth.controller";

const router = Router();

/**
 * Centralized express-validator error handler.
 */
const handleValidationErrors: RequestHandler = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  return next();
};

router.post("/login", login);
router.post("/logout", logout);
router.post("/refresh-token", refreshAccessToken);
router.get("/status", checkAuthStatus);

// Keep if implemented
router.post("/sign-up", signUp);

router.post(
  "/complete-payment",
  [
    body("name").isString().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").isString().withMessage("Password is required"),
    body("businessName").isString().withMessage("Business name is required"),
    body("stripeCustomerId").isString().withMessage("Stripe Customer ID is required"),
    body("stripeSubscriptionId").isString().withMessage("Stripe Subscription ID is required"),
    body("planType").isIn(["monthly", "yearly"]).withMessage('Plan type must be "monthly" or "yearly"'),
    body("status").isIn(["active", "inactive", "canceled"]).withMessage("Subscription status is required"),
    body("startedAt").isISO8601().withMessage("Valid start date is required"),
    body("endsAt").isISO8601().withMessage("Valid end date is required"),
    handleValidationErrors,
  ],
  createUserAndSubscription
);

router.post("/accept-invite", acceptInvite);

router.post(
  "/verify-email",
  [body("token").isString().notEmpty().withMessage("token is required"), handleValidationErrors],
  verifyEmail
);

router.post(
  "/resend-verification-email",
  [body("userId").isMongoId().withMessage("userId must be a valid ObjectId"), handleValidationErrors],
  resendVerificationEmail
);

router.post(
  "/forgot-password",
  [body("email").isEmail().withMessage("Valid email is required"), handleValidationErrors],
  forgotPassword
);

router.post(
  "/reset-password",
  [
    body("token").isString().notEmpty().withMessage("token is required"),
    body("newPassword").isString().notEmpty().withMessage("newPassword is required"),
    handleValidationErrors,
  ],
  resetPassword
);

export default router;