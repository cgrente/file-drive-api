import { NOTIFICATION_TYPES, type NotificationType } from "../models/notification.model";

export function isNotificationType(value: unknown): value is NotificationType {
  return typeof value === "string" && (NOTIFICATION_TYPES as readonly string[]).includes(value);
}