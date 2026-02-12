import { Router, type RequestHandler } from "express";
import { body, param, validationResult } from "express-validator";

import authenticate from "../middleware/auth.middleware";
import {
  getNotifications,
  getNotificationById,
  createNotification,
  updateNotification,
  deleteNotification,
  sendNotification,
} from "../controllers/notification.controller";
import { NOTIFICATION_TYPES } from "../models/notification.model";

const router = Router();

const handleValidationErrors: RequestHandler = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  return next();
};

const validateMongoIdParam = (field: string) => [
  param(field).isMongoId().withMessage(`Invalid ${field}`),
  handleValidationErrors,
];

const validateNotificationCore = [
  body("userId").isMongoId().withMessage("userId must be a valid ObjectId"),
  body("type").isIn(NOTIFICATION_TYPES as unknown as string[]).withMessage(`type must be one of: ${NOTIFICATION_TYPES.join(", ")}`),
  body("message").isString().notEmpty().withMessage("message is required"),
  handleValidationErrors,
];

router.get("/", authenticate, getNotifications);

router.get("/:id", authenticate, ...validateMongoIdParam("id"), getNotificationById);

router.post("/", authenticate, validateNotificationCore, createNotification);

router.post(
  "/send",
  authenticate,
  [
    ...validateNotificationCore,
    body("emailType").isString().notEmpty().withMessage("emailType is required"),
    body("emailData").exists().withMessage("emailData is required"),
    body("recipientEmail").isEmail().withMessage("recipientEmail must be a valid email"),
    handleValidationErrors,
  ],
  sendNotification
);

router.put(
  "/:id",
  authenticate,
  ...validateMongoIdParam("id"),
  [
    body("message").optional().isString().notEmpty().withMessage("message must be a non-empty string"),
    body("type").optional().isIn(NOTIFICATION_TYPES as unknown as string[]).withMessage(`type must be one of: ${NOTIFICATION_TYPES.join(", ")}`),
    body("isRead").optional().isBoolean().withMessage("isRead must be boolean"),
    handleValidationErrors,
  ],
  updateNotification
);

router.delete("/:id", authenticate, ...validateMongoIdParam("id"), deleteNotification);

export default router;