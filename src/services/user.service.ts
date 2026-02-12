import mongoose, { Types } from "mongoose";
import jwt from "jsonwebtoken";

import { User, type IUser } from "../models/user.model";
import { File } from "../models/file.model";
import { Folder } from "../models/folder.model";
import { Permission } from "../models/permission.model";
import { Subscription } from "../models/subscription.model";
import { BusinessModel } from "../models/business.model";
import { NotificationModel } from "../models/notification.model";

import sesService from "./ses.service";
import { AppError } from "../errors/app.errors";
import { generateTemporaryPassword } from "../utils/auth.utils";
import { requireEnv } from "../config/env";

class UserService {
  async getAlluser(): Promise<IUser[]> {
    try {
      return await User.find();
    } catch (cause) {
      throw new AppError({
        message: "Failed to fetch users",
        statusCode: 500,
        code: "USER_FETCH_FAILED",
        cause,
      });
    }
  }

  async getMembers(businessId: string): Promise<IUser[]> {
    if (!Types.ObjectId.isValid(businessId)) {
      throw new AppError({
        message: "Invalid businessId",
        statusCode: 400,
        code: "BUSINESS_INVALID_ID",
        details: { businessId },
      });
    }

    try {
      return await User.find({
        businessId: new Types.ObjectId(businessId),
        role: { $ne: "owner" },
      });
    } catch (cause) {
      throw new AppError({
        message: "Failed to fetch members",
        statusCode: 500,
        code: "MEMBERS_FETCH_FAILED",
        cause,
      });
    }
  }

  async getUserById(id: string): Promise<IUser | null> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError({
        message: "Invalid user id",
        statusCode: 400,
        code: "USER_INVALID_ID",
        details: { id },
      });
    }

    try {
      return await User.findById(id);
    } catch (cause) {
      throw new AppError({
        message: "Failed to fetch user",
        statusCode: 500,
        code: "USER_FETCH_FAILED",
        cause,
      });
    }
  }

  async getUserByEmail(email: string): Promise<IUser | null> {
    if (!email || typeof email !== "string") {
      throw new AppError({
        message: "Invalid email",
        statusCode: 400,
        code: "VALIDATION_ERROR",
      });
    }

    try {
      return await User.findOne({ email: email.toLowerCase().trim() });
    } catch (cause) {
      throw new AppError({
        message: "Failed to fetch user by email",
        statusCode: 500,
        code: "USER_FETCH_FAILED",
        cause,
      });
    }
  }

  async isUserByEmailExist(email: string): Promise<boolean> {
    const user = await this.getUserByEmail(email);
    return Boolean(user);
  }

  async createUser(userData: Partial<IUser>): Promise<IUser> {
    try {
      const user = new User(userData);
      return await user.save();
    } catch (cause) {
      throw new AppError({
        message: "Failed to create user",
        statusCode: 500,
        code: "USER_CREATE_FAILED",
        cause,
      });
    }
  }

  async updateUser(id: string, userData: Partial<IUser>): Promise<IUser | null> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError({
        message: "Invalid user id",
        statusCode: 400,
        code: "USER_INVALID_ID",
        details: { id },
      });
    }

    try {
      return await User.findByIdAndUpdate(id, userData, { new: true });
    } catch (cause) {
      throw new AppError({
        message: "Failed to update user",
        statusCode: 500,
        code: "USER_UPDATE_FAILED",
        cause,
      });
    }
  }

  /**
   * Delete a user. If role=owner, delete everything tied to the business.
   */
  async deleteUser(id: string): Promise<IUser | null> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error("Invalid user ID");
    }

    const user = await User.findById(id);
    if (!user) {
      throw new Error("User not found");
    }

    if (user.role === "owner") {
      const businessId = user.businessId;

      const usersInBusiness = await User.find({ businessId });
      const userIds = usersInBusiness.map((u) => u._id);

      await BusinessModel.deleteMany({ ownerId: user._id });

      await File.deleteMany({ businessId });
      await Folder.deleteMany({ businessId });

      await NotificationModel.deleteMany({ userId: { $in: userIds } });

      await Permission.deleteMany({ userId: { $in: userIds } });
      await Permission.deleteMany({ targetId: businessId as any });

      await Subscription.deleteMany({ userId: { $in: userIds } });

      await User.deleteMany({ businessId });
    } else {
      await User.findByIdAndDelete(id);
    }

    return user;
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new AppError({
        message: "Invalid user id",
        statusCode: 400,
        code: "USER_INVALID_ID",
        details: { userId },
      });
    }

    const user = await User.findById(userId).select("+password");
    if (!user) {
      throw new AppError({
        message: "User not found",
        statusCode: 404,
        code: "USER_NOT_FOUND",
      });
    }

    const isValid = await user.comparePassword(oldPassword);
    if (!isValid) {
      throw new AppError({
        message: "Old password is incorrect",
        statusCode: 400,
        code: "PASSWORD_INVALID",
      });
    }

    user.password = newPassword;
    await user.save();
  }

  /**
   * Invite a member:
   * - creates a user with a temporary password
   * - emails invite link + temp password
   */
  async inviteMember(name: string, email: string, businessId: string): Promise<IUser> {
    if (!Types.ObjectId.isValid(businessId)) {
      throw new AppError({
        message: "Invalid businessId",
        statusCode: 400,
        code: "BUSINESS_INVALID_ID",
        details: { businessId },
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      throw new AppError({
        message: "User with this email already exists",
        statusCode: 400,
        code: "USER_EMAIL_EXISTS",
      });
    }

    const invitationSecret = requireEnv("INVITATION_SECRET");
    const invitationExpiration = process.env.INVITATION_EXPIRATION || "24h";
    const webappUrl = requireEnv("WEBAPP_URL");

    const temporaryPassword = generateTemporaryPassword();

    const createdUser = await this.createUser({
      username: name,
      email,
      password: temporaryPassword,
      role: "member",
      businessId: new Types.ObjectId(businessId),
      isEmailVerified: false,
    });

    const inviteToken = jwt.sign(
      { email, role: "member", businessId, userId: createdUser._id },
      invitationSecret,
      { expiresIn: invitationExpiration }
    );

    const inviteLink = `${webappUrl}/accept-invite?token=${inviteToken}`;

    const emailData = sesService.generateEmailTemplate("invite", {
      receiverEmail: email,
      receiverName: name,
      inviteLink,
      temporaryPassword,
    });

    await sesService.sendEmail(emailData);

    return createdUser;
  }

  async resendInviteMember(name: string, email: string, businessId: string): Promise<void> {
    if (!Types.ObjectId.isValid(businessId)) {
      throw new AppError({
        message: "Invalid businessId",
        statusCode: 400,
        code: "BUSINESS_INVALID_ID",
        details: { businessId },
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");
    if (!user) {
      throw new AppError({
        message: "User with this email does not exist",
        statusCode: 404,
        code: "USER_NOT_FOUND",
      });
    }

    const invitationSecret = requireEnv("INVITATION_SECRET");
    const invitationExpiration = process.env.INVITATION_EXPIRATION || "24h";
    const webappUrl = requireEnv("WEBAPP_URL");

    const temporaryPassword = generateTemporaryPassword();
    user.password = temporaryPassword;
    await user.save();

    const inviteToken = jwt.sign(
      { email, role: "member", businessId, userId: user._id },
      invitationSecret,
      { expiresIn: invitationExpiration }
    );

    const inviteLink = `${webappUrl}/accept-invite?token=${inviteToken}`;

    const emailData = sesService.generateEmailTemplate("resend-invite", {
      receiverEmail: email,
      receiverName: name,
      temporaryPassword,
      inviteLink,
    });

    await sesService.sendEmail(emailData);
  }
}

export default new UserService();