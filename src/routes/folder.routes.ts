import { Router, type RequestHandler } from "express";
import { body, param, validationResult } from "express-validator";
import authenticate from "../middleware/auth.middleware";
import { checkPermission } from "../middleware/permissions.middleware";
import {
  getAllFolders,
  getFolderById,
  createFolder,
  updateFolder,
  deleteFolder,
  getFilesAndFolders,
} from "../controllers/folder.controller";

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

const validateMongoIdParam = (paramName: string) => [
  param(paramName, `Invalid ${paramName}`).isMongoId(),
  handleValidationErrors,
];

/**
 * GET /folder/files-folders/:businessId/:folderId?
 */
router.get(
  "/files-folders/:businessId/:folderId?",
  [
    param("businessId", "Invalid businessId").isMongoId(),
    param("folderId", "Invalid folderId").optional().isMongoId(),
    handleValidationErrors,
  ],
  authenticate,
  checkPermission("folder", "read"),
  getFilesAndFolders
);

/**
 * GET /folder
 */
router.get("/", authenticate, checkPermission("folder", "read"), getAllFolders);

/**
 * GET /folder/:id
 */
router.get(
  "/:id",
  authenticate,
  ...validateMongoIdParam("id"),
  checkPermission("folder", "read"),
  getFolderById
);

/**
 * POST /folder
 *
 * Best practice:
 * - userId comes from auth (req.user.id), not request body
 */
router.post(
  "/",
  authenticate,
  [
    body("folderName", "folderName is required").isString().notEmpty(),
    body("businessId", "businessId is required").isMongoId(),
    body("parentFolderId", "parentFolderId must be a valid ObjectId")
      .optional({ nullable: true })
      .isMongoId(),
    handleValidationErrors,
  ],
  checkPermission("folder", "write"),
  createFolder
);

/**
 * PUT /folder/:id
 */
router.put(
  "/:id",
  authenticate,
  ...validateMongoIdParam("id"),
  [
    body("folderName", "folderName must be non-empty").optional().isString().notEmpty(),
    handleValidationErrors,
  ],
  checkPermission("folder", "write"),
  updateFolder
);

/**
 * DELETE /folder/:id
 */
router.delete(
  "/:id",
  authenticate,
  ...validateMongoIdParam("id"),
  checkPermission("folder", "delete"),
  deleteFolder
);

export default router;