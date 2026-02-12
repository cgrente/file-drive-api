import { Types } from "mongoose";
import { Admin, type AdminSchemaType, type AdminLean } from "../models/admin.model";
import { AppError } from "../errors/app.errors";

/**
 * AdminService
 *
 * Best practices:
 * - Throw AppError with appropriate status codes
 * - Validate ObjectIds
 * - Prefer `.lean()` for read-heavy endpoints
 * - Never leak passwordHash
 */
class AdminService {
  /**
   * Fetch all admins (metadata only).
   */
  async getAllAdmins(): Promise<AdminLean[]> {
    const admins = await Admin.find()
      .select("-passwordHash") // defense-in-depth; select:false already hides it
      .lean();

    return admins as AdminLean[];
  }

  /**
   * Fetch a single admin by id.
   */
  async getAdminById(id: string): Promise<AdminLean> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError({
        message: "Invalid admin ID",
        statusCode: 400,
        code: "ADMIN_ID_INVALID",
      });
    }

    const admin = await Admin.findById(id)
      .select("-passwordHash")
      .lean();

    if (!admin) {
      throw new AppError({
        message: "Admin not found",
        statusCode: 404,
        code: "ADMIN_NOT_FOUND",
      });
    }

    return admin as AdminLean;
  }

  /**
   * Create a new admin.
   *
   * IMPORTANT:
   * - `passwordHash` must already be hashed before calling this.
   */
  async createAdmin(params: {
    username: string;
    email: string;
    passwordHash: string;
    role?: "admin" | "superadmin";
  }): Promise<AdminLean> {
    const { username, email, passwordHash, role } = params;

    if (!username?.trim() || !email?.trim() || !passwordHash?.trim()) {
      throw new AppError({
        message: "Missing required fields",
        statusCode: 400,
        code: "ADMIN_CREATE_MISSING_FIELDS",
      });
    }

    // Enforce uniqueness at app-level (still keep unique index in Mongo).
    const exists = await Admin.findOne({ email: email.trim().toLowerCase() }).lean();
    if (exists) {
      throw new AppError({
        message: "Admin email already exists",
        statusCode: 409,
        code: "ADMIN_EMAIL_EXISTS",
      });
    }

    const created = await Admin.create({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      passwordHash: passwordHash.trim(),
      role: role ?? "admin",
    });

    // Return lean payload (without passwordHash)
    const lean = await Admin.findById(created._id).select("-passwordHash").lean();
    if (!lean) {
      throw new AppError({
        message: "Failed to fetch created admin",
        statusCode: 500,
        code: "ADMIN_CREATE_FETCH_FAILED",
      });
    }

    return lean as AdminLean;
  }

  /**
   * Update an admin by id.
   *
   * Notes:
   * - Does NOT support changing passwordHash here (make a dedicated method).
   */
  async updateAdmin(
    id: string,
    adminData: Partial<Pick<AdminSchemaType, "username" | "email" | "role">>
  ): Promise<AdminLean> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError({
        message: "Invalid admin ID",
        statusCode: 400,
        code: "ADMIN_ID_INVALID",
      });
    }

    const update: Record<string, unknown> = {};

    if (typeof adminData.username === "string") update.username = adminData.username.trim();
    if (typeof adminData.email === "string") update.email = adminData.email.trim().toLowerCase();
    if (typeof adminData.role === "string") update.role = adminData.role;

    const updated = await Admin.findByIdAndUpdate(id, update, { new: true })
      .select("-passwordHash")
      .lean();

    if (!updated) {
      throw new AppError({
        message: "Admin not found for update",
        statusCode: 404,
        code: "ADMIN_NOT_FOUND",
      });
    }

    return updated as AdminLean;
  }

  /**
   * Delete an admin by id.
   */
  async deleteAdmin(id: string): Promise<AdminLean> {
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError({
        message: "Invalid admin ID",
        statusCode: 400,
        code: "ADMIN_ID_INVALID",
      });
    }

    const deleted = await Admin.findByIdAndDelete(id)
      .select("-passwordHash")
      .lean();

    if (!deleted) {
      throw new AppError({
        message: "Admin not found for deletion",
        statusCode: 404,
        code: "ADMIN_NOT_FOUND",
      });
    }

    return deleted as AdminLean;
  }
}

export default new AdminService();