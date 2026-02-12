import {
  Schema,
  model,
  type InferSchemaType,
  type HydratedDocument,
  Types,
} from "mongoose";

/**
 * Folder metadata.
 *
 * MongoDB is the source of truth.
 * s3Key is a prefix that ends with "/".
 */
const folderSchema = new Schema(
  {
    /**
     * Display name (what the user sees)
     */
    folderName: {
      type: String,
      required: [true, "folderName is required"],
      trim: true,
      validate: {
        validator: (value: string): boolean => value.trim().length > 0,
        message: "folderName cannot be empty",
      },
      index: true,
    },

    /**
     * Owner of the folder
     */
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "userId is required"],
      index: true,
    },

    /**
     * Business / workspace scope
     */
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: [true, "businessId is required"],
      index: true,
    },

    /**
     * Optional parent folder (null means "root")
     */
    parentFolderId: {
      type: Schema.Types.ObjectId,
      ref: "Folder",
      required: false,
      default: null,
      index: true,
    },

    /**
     * REQUIRED folder prefix in S3 (must end with "/")
     * Example: businessId/folders/<folderId>/
     */
    s3Key: {
      type: String,
      required: [true, "s3Key is required"],
      trim: true,
      index: true,
    },

    /**
     * Files directly inside this folder (optional convenience list)
     */
    fileIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "File",
        required: false,
      },
    ],

    /**
     * Child folders directly inside this folder (optional convenience list)
     */
    folderIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Folder",
        required: false,
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/**
 * Permissions (virtual)
 */
folderSchema.virtual("permissions", {
  ref: "Permission",
  localField: "_id",
  foreignField: "targetId",
});

/**
 * Schema-derived types (NO Document extension)
 */
export type FolderSchemaType = InferSchemaType<typeof folderSchema>;
export type FolderHydrated = HydratedDocument<FolderSchemaType>;
export type FolderId = Types.ObjectId;
export type FolderLean = FolderSchemaType & { _id: FolderId };

/**
 * Mongoose model
 */
export const Folder = model<FolderSchemaType>("Folder", folderSchema);