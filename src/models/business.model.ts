import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const BusinessSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Business name is required"],
      trim: true,
      maxlength: [100, "Business name must be less than 100 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description must be less than 500 characters"],
    },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      zipCode: { type: String, trim: true },
      country: { type: String, trim: true },
    },
    contact: {
      phone: { type: String, trim: true },
      email: {
        type: String,
        trim: true,
        match: [/.+@.+\..+/, "Invalid email address"],
      },
    },
    website: {
      type: String,
      trim: true,
      match: [/^https?:\/\/.+/, "Invalid URL format"],
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    industry: {
      type: String,
      trim: true,
      maxlength: [100, "Industry must be less than 100 characters"],
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    registrationDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

export type Business = InferSchemaType<typeof BusinessSchema>;
export type BusinessDocument = HydratedDocument<Business>;

// If you still want an exported interface-like alias
export type IBusiness = BusinessDocument;

// ✅ Runtime Mongoose model (THIS is what you call .deleteMany() on)
export const BusinessModel = model<Business>("Business", BusinessSchema);