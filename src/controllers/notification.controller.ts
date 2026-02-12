import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";

import NotificationService from "../services/notification.service";
import SESService from "../services/ses.service";
import { AppError } from "../errors/app.errors";
import { NOTIFICATION_TYPES, type NotificationType } from "../models/notification.model";

function isNotificationType(v: unknown): v is NotificationType {
  return typeof v === "string" && (NOTIFICATION_TYPES as readonly string[]).includes(v);
}

/**
 * POST /api/notifications/send
 *
 * Sends email + saves notification.
 */
export const sendNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, type, message, data, emailType, emailData, recipientEmail } = req.body ?? {};

    if (typeof userId !== "string" || !Types.ObjectId.isValid(userId)) {
      throw new AppError({ message: "userId is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }
    if (!isNotificationType(type)) {
      throw new AppError({
        message: `type must be one of: ${NOTIFICATION_TYPES.join(", ")}`,
        statusCode: 400,
        code: "VALIDATION_ERROR",
      });
    }
    if (typeof message !== "string" || message.trim() === "") {
      throw new AppError({ message: "message is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }
    if (typeof emailType !== "string" || emailType.trim() === "") {
      throw new AppError({ message: "emailType is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }
    if (!emailData) {
      throw new AppError({ message: "emailData is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }
    if (typeof recipientEmail !== "string" || recipientEmail.trim() === "") {
      throw new AppError({ message: "recipientEmail is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }

    // 1) send email
    const emailOptions = SESService.generateEmailTemplate(emailType, emailData);
    await SESService.sendEmail({ ...emailOptions, to: recipientEmail.trim() });

    // 2) store notification
    const notification = await NotificationService.createNotification({
      userId: new Types.ObjectId(userId),
      type,
      message: message.trim(),
      data: (data ?? {}) as Record<string, unknown>,
      isRead: false,
    });

    return res.status(200).json({ message: "Notification sent successfully", notification });
  } catch (err) {
    return next(err);
  }
};

export const getNotifications = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const notifications = await NotificationService.getAllNotifications();
    return res.status(200).json(notifications);
  } catch (err) {
    return next(err);
  }
};

export const getNotificationById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const notification = await NotificationService.getNotificationById(id);
    if (!notification) {
      throw new AppError({ message: "Notification not found", statusCode: 404, code: "NOTIFICATION_NOT_FOUND" });
    }

    return res.status(200).json(notification);
  } catch (err) {
    return next(err);
  }
};

export const createNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, type, message, data } = req.body ?? {};

    if (typeof userId !== "string" || !Types.ObjectId.isValid(userId)) {
      throw new AppError({ message: "userId is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }
    if (!isNotificationType(type)) {
      throw new AppError({
        message: `type must be one of: ${NOTIFICATION_TYPES.join(", ")}`,
        statusCode: 400,
        code: "VALIDATION_ERROR",
      });
    }
    if (typeof message !== "string" || message.trim() === "") {
      throw new AppError({ message: "message is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }

    const created = await NotificationService.createNotification({
      userId: new Types.ObjectId(userId),
      type,
      message: message.trim(),
      data: (data ?? {}) as Record<string, unknown>,
      isRead: false,
    });

    return res.status(201).json(created);
  } catch (err) {
    return next(err);
  }
};

export const updateNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const updated = await NotificationService.updateNotification(id, req.body ?? {});
    if (!updated) {
      throw new AppError({ message: "Notification not found", statusCode: 404, code: "NOTIFICATION_NOT_FOUND" });
    }

    return res.status(200).json(updated);
  } catch (err) {
    return next(err);
  }
};

export const deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const deleted = await NotificationService.deleteNotification(id);
    if (!deleted) {
      throw new AppError({ message: "Notification not found", statusCode: 404, code: "NOTIFICATION_NOT_FOUND" });
    }

    return res.status(200).json({ message: "Notification deleted successfully" });
  } catch (err) {
    return next(err);
  }
};