import {
  Schema,
  model,
  type InferSchemaType,
  type HydratedDocument,
  Types,
} from "mongoose";

/**
 * File metadata.
 *
 * MongoDB is the source of truth.
 * S3 object key is stable and ID-based.
 * The API never streams file bytes.
 */
const fileSchema = new Schema(
  {
    /**
     * Owner of the file
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
    folderId: {
      type: Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
      index: true,
    },

    /**
     * Display name (what the user sees)
     */
    fileName: {
      type: String,
      required: [true, "fileName is required"],
      trim: true,
      validate: {
        validator: (value: string) => value.trim().length > 0,
        message: "fileName cannot be empty",
      },
    },

    /**
     * File size in bytes
     */
    fileSize: {
      type: Number,
      required: [true, "fileSize is required"],
      min: [0, "fileSize must be >= 0"],
    },

    /**
     * MIME type (optional, but recommended)
     */
    contentType: {
      type: String,
      trim: true,
      default: null,
    },

    /**
     * Stable S3 object key.
     * Example: businessId/files/<fileId>
     */
    s3Key: {
      type: String,
      required: [true, "s3Key is required"],
      trim: true,
      unique: true,
      index: true,
    },
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
fileSchema.virtual("permissions", {
  ref: "Permission",
  localField: "_id",
  foreignField: "targetId",
});

/**
 * Schema-derived types (NO Document extension)
 */
export type FileSchemaType = InferSchemaType<typeof fileSchema>;
export type FileHydrated = HydratedDocument<FileSchemaType>;
export type FileId = Types.ObjectId;
export type FileLean = FileSchemaType & { _id: FileId };

/**
 * Mongoose model
 */
export const File = model<FileSchemaType>("File", fileSchema);