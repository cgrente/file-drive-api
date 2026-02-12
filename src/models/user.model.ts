import { Schema, model, type Document, type Types } from "mongoose";
import bcrypt from "bcrypt";

const SALT_ROUNDS = 12;

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;

  role: "owner" | "member" | "admin";

  stripeCustomerId?: string | null;
  awsId?: Types.ObjectId;
  subscriptionId?: Types.ObjectId;
  refreshToken?: string | null;
  businessId?: Types.ObjectId;

  isEmailVerified: boolean;

  emailVerificationToken?: string | null;
  emailVerificationTokenExpires?: Date | null;

  resetPasswordToken?: string | null;
  resetPasswordTokenExpires?: Date | null;

  createdAt: Date;
  updatedAt: Date;

  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      match: [/.+@.+\..+/, "Invalid email address"],
      trim: true,
      lowercase: true,
      index: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },

    role: {
      type: String,
      enum: ["owner", "member", "admin"],
      default: "owner",
      index: true,
    },

    stripeCustomerId: {
      type: String,
      default: null,
      trim: true,
      validate: {
        validator: (v: string | null) => v == null || v.trim().length > 0,
        message: "Stripe customer ID cannot be empty",
      },
    },

    awsId: {
      type: Schema.Types.ObjectId,
      ref: "Aws",
      default: null,
    },

    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
    },

    refreshToken: {
      type: String,
      default: null,
      select: false,
    },

    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      default: null,
      index: true,
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    emailVerificationToken: {
      type: String,
      default: null,
      select: false,
    },

    emailVerificationTokenExpires: {
      type: Date,
      default: null,
    },

    resetPasswordToken: {
      type: String,
      default: null,
      select: false,
    },

    resetPasswordTokenExpires: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

userSchema.pre("save", async function (next) {
  try {
    if (this.isModified("password")) {
      this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
    }
    return next();
  } catch (err) {
    return next(err as any);
  }
});

userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = model<IUser>("User", userSchema);