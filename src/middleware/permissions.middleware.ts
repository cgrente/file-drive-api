import type { Request, Response, NextFunction, RequestHandler } from "express";
import { Types } from "mongoose";

import { AppError } from "../errors/app.errors";
import { Permission } from "../models/permission.model";
import { File, type FileHydrated } from "../models/file.model";
import { Folder, type FolderHydrated } from "../models/folder.model";

type Resource = "file" | "folder";
type Action = "read" | "write" | "create" | "delete" | "owner";

function isAction(action: string): action is Action {
  return ["read", "write", "create", "delete", "owner"].includes(action);
}

/**
 * Authorization middleware:
 * - requires authenticate middleware (req.auth)
 * - allows if:
 *   1) user owns the resource, OR
 *   2) has global permission including action, OR
 *   3) has specific permission for (targetType,targetId) including action
 */
export function checkPermission(resource: Resource, action: string): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!isAction(action)) {
        throw new AppError({
          message: "Invalid permission action",
          statusCode: 500,
          code: "PERMISSION_INVALID_ACTION",
          details: { action },
        });
      }

      const auth = req.auth;
      if (!auth?.userIdString) {
        throw new AppError({
          message: "Not authenticated",
          statusCode: 401,
          code: "NOT_AUTHENTICATED",
        });
      }

      const resourceId = req.params.id;
      if (!Types.ObjectId.isValid(resourceId)) {
        throw new AppError({
          message: "Invalid resource id",
          statusCode: 400,
          code: "INVALID_ID",
          details: { resourceId },
        });
      }

      // 1) Ownership check
      let ownerId: string | undefined;

      if (resource === "folder") {
        const folderDoc: FolderHydrated | null = await Folder.findById(resourceId);
        if (!folderDoc) {
          throw new AppError({ message: "Folder not found", statusCode: 404, code: "FOLDER_NOT_FOUND" });
        }
        ownerId = folderDoc.userId.toString();
      } else {
        const fileDoc: FileHydrated | null = await File.findById(resourceId);
        if (!fileDoc) {
          throw new AppError({ message: "File not found", statusCode: 404, code: "FILE_NOT_FOUND" });
        }
        ownerId = fileDoc.userId.toString();
      }

      if (ownerId === auth.userIdString) {
        return next();
      }

      // 2) Global permission
      const hasGlobal = await Permission.exists({
        userId: auth.userId,
        isGlobal: true,
        accessLevel: action, // Mongo: array contains
      });

      if (hasGlobal) {
        return next();
      }

      // 3) Specific permission
      const hasSpecific = await Permission.exists({
        userId: auth.userId,
        isGlobal: false,
        targetType: resource,
        targetId: new Types.ObjectId(resourceId),
        accessLevel: action,
      });

      if (hasSpecific) {
        return next();
      }

      throw new AppError({
        message: "Access denied",
        statusCode: 403,
        code: "FORBIDDEN",
        details: { resource, action },
      });
    } catch (err) {
      return next(err);
    }
  };
}