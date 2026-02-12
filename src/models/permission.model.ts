import { Schema, model, type Document, type Types } from "mongoose";

export const ACCESS_LEVELS = ["read", "write", "create", "delete", "owner"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export interface IPermission extends Document {
  userId: Types.ObjectId;
  targetId?: Types.ObjectId;
  targetType?: "file" | "folder";
  accessLevel: AccessLevel[];
  isGlobal: boolean;
}

const permissionSchema = new Schema<IPermission>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetId: { type: Schema.Types.ObjectId },
    targetType: { type: String, enum: ["file", "folder"] },
    accessLevel: {
      type: [String],
      enum: ACCESS_LEVELS,
      required: true,
    },
    isGlobal: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Permission = model<IPermission>("Permission", permissionSchema);