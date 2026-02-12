import { AppError } from "../errors/app.errors";
import { NotificationModel, type NotificationDocument, type Notification } from "../models/notification.model";

class NotificationService {
  async getAllNotifications(): Promise<NotificationDocument[]> {
    try {
      return await NotificationModel.find().sort({ createdAt: -1 }).populate("userId");
    } catch (cause) {
      throw new AppError({
        message: "Failed to fetch notifications",
        statusCode: 500,
        code: "NOTIFICATION_FETCH_FAILED",
        cause,
      });
    }
  }

  async getNotificationById(id: string): Promise<NotificationDocument | null> {
    try {
      return await NotificationModel.findById(id).populate("userId");
    } catch (cause) {
      throw new AppError({
        message: "Failed to fetch notification",
        statusCode: 500,
        code: "NOTIFICATION_FETCH_FAILED",
        cause,
      });
    }
  }

  async createNotification(
    data: Pick<Notification, "userId" | "type" | "message"> &
      Partial<Pick<Notification, "data" | "isRead">>
  ): Promise<NotificationDocument> {
    try {
      const notification = new NotificationModel(data);
      return await notification.save();
    } catch (cause) {
      throw new AppError({
        message: "Failed to create notification",
        statusCode: 500,
        code: "NOTIFICATION_CREATE_FAILED",
        cause,
      });
    }
  }

  async updateNotification(
    id: string,
    data: Partial<Pick<Notification, "message" | "data" | "isRead" | "type">>
  ): Promise<NotificationDocument | null> {
    try {
      return await NotificationModel.findByIdAndUpdate(id, data, { new: true }).populate("userId");
    } catch (cause) {
      throw new AppError({
        message: "Failed to update notification",
        statusCode: 500,
        code: "NOTIFICATION_UPDATE_FAILED",
        cause,
      });
    }
  }

  async deleteNotification(id: string): Promise<NotificationDocument | null> {
    try {
      return await NotificationModel.findByIdAndDelete(id);
    } catch (cause) {
      throw new AppError({
        message: "Failed to delete notification",
        statusCode: 500,
        code: "NOTIFICATION_DELETE_FAILED",
        cause,
      });
    }
  }
}

export default new NotificationService();