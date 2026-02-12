import {
  Schema,
  model,
  type InferSchemaType,
  type HydratedDocument,
  Types,
} from "mongoose";

/**
 * Admin metadata.
 *
 * Notes:
 * - Password must be stored hashed (never plaintext).
 * - MongoDB is the source of truth.
 */
const adminSchema = new Schema(
  {
    /**
     * Admin's username.
     */
    username: {
      type: String,
      required: [true, "username is required"],
      trim: true,
      minlength: [2, "username must be at least 2 characters"],
      maxlength: [64, "username must be at most 64 characters"],
      index: true,
    },

    /**
     * Admin's email address.
     */
    email: {
      type: String,
      required: [true, "email is required"],
      trim: true,
      lowercase: true,
      // Keep a simple validation here; do deeper validation at the API layer if needed.
      match: [/.+@.+\..+/, "Invalid email address"],
      index: true,
      unique: true,
    },

    /**
     * Password hash (never store plaintext).
     */
    passwordHash: {
      type: String,
      required: [true, "passwordHash is required"],
      trim: true,
      select: false, // ✅ do not return by default
    },

    /**
     * Role / authorization level.
     */
    role: {
      type: String,
      enum: ["admin", "superadmin"],
      default: "admin",
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
 * Schema-derived types (NO Document extension).
 */
export type AdminSchemaType = InferSchemaType<typeof adminSchema>;
export type AdminHydrated = HydratedDocument<AdminSchemaType>;
export type AdminId = Types.ObjectId;
export type AdminLean = AdminSchemaType & { _id: AdminId };

/**
 * Mongoose model.
 */
export const Admin = model<AdminSchemaType>("Admin", adminSchema);