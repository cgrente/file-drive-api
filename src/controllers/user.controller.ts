import type { Request, Response, NextFunction } from "express";

import userService from "../services/user.service";
import { AppError } from "../errors/app.errors";

/**
 * GET /api/user
 */
export const getuser = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await userService.getAlluser();
    return res.status(200).json(users);
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/user/:id
 */
export const getUserById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const user = await userService.getUserById(id);
    if (!user) {
      throw new AppError({
        message: "User not found",
        statusCode: 404,
        code: "USER_NOT_FOUND",
      });
    }

    return res.status(200).json(user);
  } catch (err) {
    return next(err);
  }
};

/**
 * PUT /api/user/:id
 */
export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const updated = await userService.updateUser(id, req.body ?? {});
    if (!updated) {
      throw new AppError({
        message: "User not found",
        statusCode: 404,
        code: "USER_NOT_FOUND",
      });
    }

    return res.status(200).json(updated);
  } catch (err) {
    return next(err);
  }
};

/**
 * DELETE /api/user/:id
 */
export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const deleted = await userService.deleteUser(id);
    return res.status(200).json({ message: "User deleted successfully", user: deleted });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/user/change-password
 * Body: { id, oldPassword, newPassword }
 */
export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { oldPassword, newPassword, id } = req.body ?? {};

    if (!id || typeof id !== "string") {
      throw new AppError({ message: "id is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }
    if (!oldPassword || typeof oldPassword !== "string") {
      throw new AppError({ message: "oldPassword is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }
    if (!newPassword || typeof newPassword !== "string") {
      throw new AppError({ message: "newPassword is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }

    await userService.changePassword(id, oldPassword, newPassword);

    return res.status(200).json({ message: "Password changed successfully" });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/user/members/:id
 * (id = businessId)
 */
export const getMembers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const members = await userService.getMembers(id);
    return res.status(200).json(members);
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/user/members/invite
 * Body: { name, email, businessId }
 */
export const inviteMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, businessId } = req.body ?? {};

    if (!name || typeof name !== "string") {
      throw new AppError({ message: "name is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }
    if (!email || typeof email !== "string") {
      throw new AppError({ message: "email is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }
    if (!businessId || typeof businessId !== "string") {
      throw new AppError({ message: "businessId is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }

    const user = await userService.inviteMember(name, email, businessId);
    return res.status(200).json(user);
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/user/members/resend-invite
 * Body: { name, email, businessId }
 */
export const resendInviteMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, businessId } = req.body ?? {};

    if (!name || typeof name !== "string") {
      throw new AppError({ message: "name is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }
    if (!email || typeof email !== "string") {
      throw new AppError({ message: "email is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }
    if (!businessId || typeof businessId !== "string") {
      throw new AppError({ message: "businessId is required", statusCode: 400, code: "VALIDATION_ERROR" });
    }

    await userService.resendInviteMember(name, email, businessId);
    return res.status(200).json({ message: "Invite resent successfully" });
  } catch (err) {
    return next(err);
  }
};