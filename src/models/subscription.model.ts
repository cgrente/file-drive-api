import { Schema, model, type Document, type Types } from "mongoose";

/**
 * Interface defining the structure of a Subscription document in MongoDB.
 */
export interface ISubscription extends Document {
  userId: Types.ObjectId;

  stripeCustomerId: string;
  stripeSubscriptionId: string;

  planType: "monthly" | "yearly" | "yearly_presale" | "test";
  priceId: string;

  status: "active" | "inactive" | "canceled";

  startedAt: Date;
  endsAt: Date;

  cancellationAt?: Date | null;
  cancellationReason?: string | null;

  trialStart?: Date | null;
  trialEnd?: Date | null;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },

    stripeCustomerId: {
      type: String,
      required: [true, "Stripe customer ID is required"],
      trim: true,
    },

    stripeSubscriptionId: {
      type: String,
      required: [true, "Stripe subscription ID is required"],
      trim: true,
      index: true,
    },

    priceId: {
      type: String,
      required: [true, "Stripe price ID is required"],
      trim: true,
    },

    planType: {
      type: String,
      enum: ["monthly", "yearly", "yearly_presale", "test"],
      required: [true, "Subscription planType is required"],
    },

    status: {
      type: String,
      enum: ["active", "inactive", "canceled"],
      required: [true, "Subscription status is required"],
      index: true,
    },

    startedAt: {
      type: Date,
      required: [true, "Subscription start date is required"],
    },

    endsAt: {
      type: Date,
      required: [true, "Subscription end date is required"],
    },

    cancellationAt: { type: Date, default: null },
    cancellationReason: { type: String, trim: true, default: null },

    trialStart: { type: Date, default: null },
    trialEnd: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

export const Subscription = model<ISubscription>("Subscription", subscriptionSchema);