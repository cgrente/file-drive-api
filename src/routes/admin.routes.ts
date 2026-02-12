import { Router, type RequestHandler } from "express";
import { body, param, validationResult } from "express-validator";

import authenticate from "../middleware/auth.middleware";
import {
  getAdmins,
  getAdminById,
  createAdmin,
  updateAdmin,
  deleteAdmin,
} from "../controllers/admin.controller";

const router = Router();

/**
 * Centralized express-validator error handler.
 * Keep it close to the routes so every endpoint returns consistent 400 payloads.
 */
const handleValidationErrors: RequestHandler = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

/**
 * Reusable validator for MongoDB ObjectId params.
 */
const validateMongoIdParam = (paramName: string) => [
  param(paramName, `Invalid ${paramName}`).isMongoId(),
  handleValidationErrors,
];

/**
 * DTO: CreateAdmin
 * API accepts plaintext password; controller/service hashes it into passwordHash.
 */
const validateCreateAdmin = [
  body("username", "username is required").isString().trim().notEmpty(),
  body("email", "email must be a valid email").isEmail().normalizeEmail(),
  body("password", "password is required").isString().isLength({ min: 8, max: 128 }),
  body("role", 'role must be either "admin" or "superadmin"')
    .optional()
    .isIn(["admin", "superadmin"]),
  handleValidationErrors,
];

/**
 * DTO: UpdateAdmin
 * We intentionally do NOT allow password updates here.
 * If needed, create a dedicated endpoint (e.g. PUT /admin/:id/password).
 */
const validateUpdateAdmin = [
  body("username", "username must be non-empty").optional().isString().trim().notEmpty(),
  body("email", "email must be valid").optional().isEmail().normalizeEmail(),
  body("role", 'role must be either "admin" or "superadmin"')
    .optional()
    .isIn(["admin", "superadmin"]),
  handleValidationErrors,
];

/**
 * GET /admin
 * List admins (no passwordHash).
 */
router.get("/", authenticate, getAdmins);

/**
 * GET /admin/:id
 * Get admin by id (no passwordHash).
 */
router.get("/:id", authenticate, ...validateMongoIdParam("id"), getAdminById);

/**
 * POST /admin
 * Create admin (plaintext password in request → hashed in controller/service).
 */
router.post("/", authenticate, validateCreateAdmin, createAdmin);

/**
 * PUT /admin/:id
 * Update username/email/role only.
 */
router.put(
  "/:id",
  authenticate,
  ...validateMongoIdParam("id"),
  validateUpdateAdmin,
  updateAdmin
);

/**
 * DELETE /admin/:id
 * Delete admin.
 */
router.delete("/:id", authenticate, ...validateMongoIdParam("id"), deleteAdmin);

export default router;