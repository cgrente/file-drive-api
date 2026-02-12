import { Router, type RequestHandler } from "express";
import { body, param, validationResult } from "express-validator";

import authenticate from "../middleware/auth.middleware";
import {
  grantGlobalPermission,
  grantSpecificPermission,
  revokePermission,
  listPermissionsForTarget,
  getGlobalPermissionsForUser,
  getSpecificPermissionsForUser,
} from "../controllers/permission.controller";
import { ACCESS_LEVELS } from "../models/permission.model";

const router = Router();

const handleValidationErrors: RequestHandler = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  return next();
};

const validateAccessLevelArray = body("accessLevel")
  .isArray({ min: 1 })
  .withMessage("accessLevel must be a non-empty array")
  .custom((arr) => Array.isArray(arr) && arr.every((v) => ACCESS_LEVELS.includes(String(v) as any)))
  .withMessage(`accessLevel contains invalid values. Allowed: ${ACCESS_LEVELS.join(", ")}`);

router.post(
  "/global",
  [
    authenticate,
    body("userId").isMongoId().withMessage("User ID must be a valid MongoDB ObjectId"),
    validateAccessLevelArray,
    handleValidationErrors,
  ],
  grantGlobalPermission
);

router.post(
  "/specific",
  [
    authenticate,
    body("userId").isMongoId().withMessage("User ID must be a valid MongoDB ObjectId"),
    body("targetId").isMongoId().withMessage("Target ID must be a valid MongoDB ObjectId"),
    body("targetType").isIn(["file", "folder"]).withMessage('targetType must be "file" or "folder"'),
    validateAccessLevelArray,
    handleValidationErrors,
  ],
  grantSpecificPermission
);

router.get(
  "/global/:userId",
  [authenticate, param("userId").isMongoId().withMessage("userId must be a valid ObjectId"), handleValidationErrors],
  getGlobalPermissionsForUser
);

router.get(
  "/specific/:userId/:targetId",
  [
    authenticate,
    param("userId").isMongoId().withMessage("userId must be a valid ObjectId"),
    param("targetId").isMongoId().withMessage("targetId must be a valid ObjectId"),
    handleValidationErrors,
  ],
  getSpecificPermissionsForUser
);

router.delete(
  "/:id",
  [authenticate, param("id").isMongoId().withMessage("Permission ID must be a valid ObjectId"), handleValidationErrors],
  revokePermission
);

router.get(
  "/target/:targetId",
  [
    authenticate,
    param("targetId").isMongoId().withMessage("Target ID must be a valid ObjectId"),
    handleValidationErrors,
  ],
  listPermissionsForTarget
);

export default router;