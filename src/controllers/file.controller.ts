import type { Request, Response, NextFunction } from "express";
import fileService from "../services/file.service";

/**
 * Response type for GET /file/:id
 */
type FileWithDownloadUrl = Record<string, unknown> & { downloadUrl?: string };

/**
 * GET /file/:id
 */
export const getFileById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const fileId = req.params.id;
    const file = await fileService.getFileById(fileId);

    if (!file) {
      res.status(404).json({ message: "File not found" });
      return;
    }

    res.status(200).json(file as FileWithDownloadUrl);
  } catch (error) {
    next(error);
  }
};

/**
 * Body type for POST /file/upload/start
 */
type StartUploadBody = {
  businessId: string;
  userId: string;
  folderId?: string | null;
  fileName: string;
  fileSize: number;
  contentType?: string | null;
};

/**
 * POST /file/upload/start
 */
export const startFileUpload = async (
  req: Request<{}, {}, StartUploadBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const startResult = await fileService.startUpload({
      businessId: req.body.businessId,
      userId: req.body.userId,
      folderId: req.body.folderId ?? null,
      fileName: req.body.fileName,
      fileSize: Number(req.body.fileSize),
      contentType: req.body.contentType ?? undefined,
    });

    res.status(200).json(startResult);
  } catch (error) {
    next(error);
  }
};

/**
 * Body type for POST /file/upload/complete
 */
type CompleteUploadBody = {
  fileId: string;
  businessId: string;
  userId: string;
  folderId?: string | null;
  fileName: string;
  fileSize: number;
  contentType?: string | null;
  s3Key: string;
};

/**
 * POST /file/upload/complete
 */
export const completeFileUpload = async (
  req: Request<{}, {}, CompleteUploadBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const createdFile = await fileService.completeUpload({
      fileId: req.body.fileId,
      businessId: req.body.businessId,
      userId: req.body.userId,
      folderId: req.body.folderId ?? null,
      fileName: req.body.fileName,
      fileSize: Number(req.body.fileSize),
      contentType: req.body.contentType ?? undefined,
      s3Key: req.body.s3Key,
    });

    res.status(201).json(createdFile);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /file/:id
 * Metadata-only update.
 */
export const updateFile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const fileId = req.params.id;

    // Prevent accidental s3Key changes via endpoint
    const updatePayload = { ...req.body } as Record<string, unknown>;
    delete updatePayload.s3Key;

    const updatedFile = await fileService.updateFile(fileId, updatePayload);

    if (!updatedFile) {
      res.status(404).json({ message: "File not found for update" });
      return;
    }

    res.status(200).json(updatedFile);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /file/:id
 */
export const deleteFile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const fileId = req.params.id;
    const deletedFile = await fileService.deleteFile(fileId);

    if (!deletedFile) {
      res.status(404).json({ message: "File not found for deletion" });
      return;
    }

    res.status(200).json({ message: "File deleted" });
  } catch (error) {
    next(error);
  }
};