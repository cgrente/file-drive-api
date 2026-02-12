import { Router, type RequestHandler } from "express";
import { body, param, validationResult } from "express-validator";
import authenticate from "../middleware/auth.middleware";
import { checkPermission } from "../middleware/permissions.middleware";
import {
  getFileById,
  startFileUpload,
  completeFileUpload,
  updateFile,
  deleteFile,
} from "../controllers/file.controller";

const router = Router();

/**
 * Centralized express-validator error handler.
 */
const handleValidationErrors: RequestHandler = (req, res, next) => {
  const validationErrors = validationResult(req);
  if (!validationErrors.isEmpty()) {
    return res.status(400).json({ errors: validationErrors.array() });
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
 * GET /file/:id
 * Fetch file metadata + presigned download URL.
 */
router.get(
  "/:id",
  authenticate,
  ...validateMongoIdParam("id"),
  checkPermission("file", "read"),
  getFileById
);

/**
 * POST /file/upload/start
 *
 * Best practice:
 * - userId comes from auth (req.user.id), not request body
 */
router.post(
  "/upload/start",
  authenticate,
  [
    body("businessId", "businessId is required").isMongoId(),
    body("folderId", "folderId must be a valid ObjectId")
      .optional({ nullable: true })
      .isMongoId(),
    body("fileName", "fileName is required").isString().notEmpty(),
    body("fileSize", "fileSize must be a non-negative number")
      .isNumeric()
      .custom((value) => Number(value) >= 0),
    body("contentType", "contentType must be a string")
      .optional({ nullable: true })
      .isString(),
    handleValidationErrors,
  ],
  checkPermission("file", "write"),
  startFileUpload
);

/**
 * POST /file/upload/complete
 *
 * Best practice:
 * - userId comes from auth (req.user.id), not request body
 */
router.post(
  "/upload/complete",
  authenticate,
  [
    body("fileId", "fileId is required").isMongoId(),
    body("businessId", "businessId is required").isMongoId(),
    body("folderId", "folderId must be a valid ObjectId")
      .optional({ nullable: true })
      .isMongoId(),
    body("fileName", "fileName is required").isString().notEmpty(),
    body("fileSize", "fileSize must be a non-negative number")
      .isNumeric()
      .custom((value) => Number(value) >= 0),
    body("contentType", "contentType must be a string")
      .optional({ nullable: true })
      .isString(),
    body("s3Key", "s3Key is required").isString().notEmpty(),
    handleValidationErrors,
  ],
  checkPermission("file", "write"),
  completeFileUpload
);

/**
 * PUT /file/:id
 * Rename/move metadata only (no S3 moves)
 */
router.put(
  "/:id",
  authenticate,
  ...validateMongoIdParam("id"),
  [
    body("fileName", "fileName must be non-empty").optional().isString().notEmpty(),
    body("folderId", "folderId must be a valid ObjectId").optional({ nullable: true }).isMongoId(),
    body("contentType", "contentType must be a string").optional({ nullable: true }).isString(),
    handleValidationErrors,
  ],
  checkPermission("file", "write"),
  updateFile
);

/**
 * DELETE /file/:id
 */
router.delete(
  "/:id",
  authenticate,
  ...validateMongoIdParam("id"),
  checkPermission("file", "delete"),
  deleteFile
);

export default router;