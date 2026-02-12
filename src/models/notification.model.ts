import { Schema, model, type Document, type Types } from "mongoose";

export const NOTIFICATION_TYPES = ["welcome", "file_shared", "permission_revoked", "password_reset", "general"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface INotification extends Document {
  userId: Types.ObjectId;
  type: NotificationType;
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: [true, "User ID is required"] },
    type: { type: String, enum: NOTIFICATION_TYPES, default: "general", required: true },
    message: { type: String, required: [true, "Message is required"], trim: true },
    data: { type: Schema.Types.Mixed, default: {} },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// ✅ Runtime Mongoose model (THIS is what you call .deleteMany() on)
export const NotificationModel = model<INotification>("Notification", NotificationSchema);

// App-level helpful types
export type Notification = {
  userId: Types.ObjectId;
  type: NotificationType;
  message: string;
  data?: Record<string, unknown>;
  isRead: boolean;
};

export type NotificationDocument = INotification;