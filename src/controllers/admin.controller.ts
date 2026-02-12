import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";

import AdminService from "../services/admin.service";
import { AppError } from "../errors/app.errors";

/**
 * DTOs (request bodies)
 */
type CreateAdminBody = {
  username: string;
  email: string;
  password: string; // plaintext incoming
  role?: "admin" | "superadmin";
};

type UpdateAdminBody = {
  username?: string;
  email?: string;
  role?: "admin" | "superadmin";
  // intentionally no password update here
};

/**
 * Shape returned to the client (never expose passwordHash).
 */
type AdminPublic = {
  _id: string;
  username: string;
  email: string;
  role: "admin" | "superadmin";
  createdAt?: Date;
  updatedAt?: Date;
};

/**
 * Helper to strip sensitive fields from Mongoose docs / lean objects.
 */
function toAdminPublic(admin: any): AdminPublic {
  return {
    _id: admin._id?.toString?.() ?? String(admin._id),
    username: admin.username,
    email: admin.email,
    role: admin.role,
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt,
  };
}

/**
 * Get all admins
 * @route GET /admin
 * @desc Fetch all admins from the database
 * @access Protected (authenticate middleware)
 */
export async function getAdmins(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const admins = await AdminService.getAllAdmins();

    // Ensure we never leak passwordHash even if the service returns it.
    res.status(200).json(admins.map(toAdminPublic));
  } catch (error) {
    next(error);
  }
}

/**
 * Get a single admin by ID
 * @route GET /admin/:id
 * @desc Fetch an admin by its ID
 * @access Protected
 */
export async function getAdminById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const admin = await AdminService.getAdminById(id);
    if (!admin) {
      throw new AppError({
        message: "Admin not found",
        statusCode: 404,
        code: "ADMIN_NOT_FOUND",
      });
    }

    res.status(200).json(toAdminPublic(admin));
  } catch (error) {
    next(error);
  }
}

/**
 * Create an admin
 * @route POST /admin
 * @desc Create a new admin in the database
 * @access Protected
 */
export async function createAdmin(
  req: Request<{}, {}, CreateAdminBody>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { username, email, password, role } = req.body;

    // These should already be validated by express-validator, but keep a safe guard.
    if (!username || !email || !password) {
      throw new AppError({
        message: "Missing required fields (username, email, password)",
        statusCode: 400,
        code: "VALIDATION_ERROR",
      });
    }

    // Hash password (best practice)
    const passwordHash = await bcrypt.hash(password, 12);

    const created = await AdminService.createAdmin({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      role: role ?? "admin",
    });

    res.status(201).json(toAdminPublic(created));
  } catch (error: any) {
    // Optional: if your service throws Mongo duplicate key error for email
    // you can map it here to a 409.
    if (error?.code === 11000) {
      return next(
        new AppError({
          message: "Email already exists",
          statusCode: 409,
          code: "ADMIN_EMAIL_EXISTS",
          details: error?.keyValue,
          cause: error,
        })
      );
    }

    next(error);
  }
}

/**
 * Update an admin by ID
 * @route PUT /admin/:id
 * @desc Update username/email/role by ID
 * @access Protected
 */
export async function updateAdmin(
  req: Request<{ id: string }, {}, UpdateAdminBody>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    // Do not allow password changes through this endpoint.
    // If client sends it anyway, reject explicitly.
    if ((req.body as any).password || (req.body as any).passwordHash) {
      throw new AppError({
        message: "Password updates are not allowed on this endpoint",
        statusCode: 400,
        code: "PASSWORD_UPDATE_NOT_ALLOWED",
      });
    }

    const updated = await AdminService.updateAdmin(id, {
      ...(req.body.username ? { username: req.body.username.trim() } : {}),
      ...(req.body.email ? { email: req.body.email.trim().toLowerCase() } : {}),
      ...(req.body.role ? { role: req.body.role } : {}),
    });

    if (!updated) {
      throw new AppError({
        message: "Admin not found for update",
        statusCode: 404,
        code: "ADMIN_NOT_FOUND",
      });
    }

    res.status(200).json(toAdminPublic(updated));
  } catch (error) {
    next(error);
  }
}

/**
 * Delete an admin by ID
 * @route DELETE /admin/:id
 * @desc Delete an admin from the database
 * @access Protected
 */
export async function deleteAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const deleted = await AdminService.deleteAdmin(id);
    if (!deleted) {
      throw new AppError({
        message: "Admin not found for deletion",
        statusCode: 404,
        code: "ADMIN_NOT_FOUND",
      });
    }

    res.status(200).json({ message: "Admin deleted successfully" });
  } catch (error) {
    next(error);
  }
}