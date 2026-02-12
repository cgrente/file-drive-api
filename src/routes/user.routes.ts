import { Router } from "express";
import { body, param, validationResult } from "express-validator";

import authenticate from "../middleware/auth.middleware";
import {
  getuser,
  getUserById,
  updateUser,
  deleteUser,
  changePassword,
  getMembers,
  inviteMember,
  resendInviteMember,
} from "../controllers/user.controller";

const router = Router();

/**
 * Centralized express-validator handler
 */
const handleValidationErrors = (req: any, res: any, next: any) => {
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
 * GET /api/user
 */
router.get("/", authenticate, getuser);

/**
 * GET /api/user/:id
 */
router.get(
  "/:id",
  authenticate,
  param("id").isMongoId().withMessage("Invalid User ID"),
  handleValidationErrors,
  getUserById
);

/**
 * PUT /api/user/:id
 */
router.put(
  "/:id",
  authenticate,
  param("id").isMongoId().withMessage("Invalid User ID"),
  handleValidationErrors,
  updateUser
);

/**
 * DELETE /api/user/:id
 */
router.delete(
  "/:id",
  authenticate,
  param("id").isMongoId().withMessage("Invalid User ID"),
  handleValidationErrors,
  deleteUser
);

/**
 * POST /api/user/change-password
 */
router.post(
  "/change-password",
  authenticate,
  body("id").isMongoId().withMessage("id must be a MongoId"),
  body("oldPassword").isString().withMessage("oldPassword is required"),
  body("newPassword").isLength({ min: 6 }).withMessage("newPassword must be at least 6 characters"),
  handleValidationErrors,
  changePassword
);

/**
 * GET /api/user/members/:id
 * (id = businessId)
 */
router.get(
  "/members/:id",
  authenticate,
  param("id").isMongoId().withMessage("Invalid Business ID"),
  handleValidationErrors,
  getMembers
);

/**
 * POST /api/user/members/invite
 */
router.post(
  "/members/invite",
  authenticate,
  body("name").isString().withMessage("Name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("businessId").isMongoId().withMessage("businessId must be a MongoId"),
  handleValidationErrors,
  inviteMember
);

/**
 * POST /api/user/members/resend-invite
 */
router.post(
  "/members/resend-invite",
  authenticate,
  body("name").isString().withMessage("Name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("businessId").isMongoId().withMessage("businessId must be a MongoId"),
  handleValidationErrors,
  resendInviteMember
);

export default router;