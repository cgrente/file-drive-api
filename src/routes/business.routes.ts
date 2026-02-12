import { Router, type RequestHandler } from "express";
import { param, body, validationResult } from "express-validator";

import authenticate from "../middleware/auth.middleware";
import { getBusiness, updateBusiness } from "../controllers/business.controller";

const router = Router();

/**
 * Centralized express-validator error handler.
 */
const handleValidationErrors: RequestHandler = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return next();
};

/**
 * GET /api/business/:id
 */
router.get(
  "/:id",
  [authenticate, param("id").isMongoId().withMessage("id must be a valid ObjectId"), handleValidationErrors],
  getBusiness
);

/**
 * PUT /api/business/:id
 * Body: { name }
 */
router.put(
  "/:id",
  [
    authenticate,
    param("id").isMongoId().withMessage("id must be a valid ObjectId"),
    body("name").isString().trim().notEmpty().withMessage("name is required"),
    handleValidationErrors,
  ],
  updateBusiness
);

export default router;