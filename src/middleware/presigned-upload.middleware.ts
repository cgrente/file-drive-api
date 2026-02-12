import { Request, Response, NextFunction } from "express";
import fileService from "../services/file.service";

/**
 * Generate a presigned URL for uploading a file directly to S3.
 *
 * Architecture:
 * - Client uploads bytes directly to S3 using the presigned URL.
 * - Server generates stable s3Key (ID-based) and returns it.
 * - Client then calls `completeUpload` to write metadata to Mongo.
 */
export const presignedUploadMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const businessId = String(req.body.businessId ?? "");
    const userId = String(req.body.userId ?? "");
    const folderIdRaw = req.body.folderId;
    const folderId = folderIdRaw ? String(folderIdRaw) : null;

    const fileName = String(req.body.fileName ?? "");
    const contentTypeRaw = req.body.contentType;
    const contentType = contentTypeRaw ? String(contentTypeRaw) : undefined;

    const fileSizeRaw = req.body.fileSize ?? req.body.size;
    const fileSize = fileSizeRaw === undefined ? undefined : Number(fileSizeRaw);

    if (!businessId || !userId) {
      return res.status(400).json({ message: "businessId and userId are required" });
    }
    if (!fileName) {
      return res.status(400).json({ message: "fileName is required" });
    }
    if (fileSize !== undefined && (!Number.isFinite(fileSize) || fileSize < 0)) {
      return res.status(400).json({ message: "fileSize must be a number >= 0" });
    }

    // ✅ Single source of truth: generate fileId + s3Key + uploadUrl
    const uploadStart = await fileService.startUpload({
      businessId,
      userId,
      folderId,
      fileName,
      fileSize: fileSize ?? 0,
      contentType,
    });

    return res.status(200).json(uploadStart);
  } catch (error) {
    next(error);
  }
};