import type { Request, Response, NextFunction } from "express";
import folderService from "../services/folder.service";

/**
 * GET /folder
 */
export const getAllFolders = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const folders = await folderService.getAllFolders();
    res.status(200).json(folders);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /folder/:id
 */
export const getFolderById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const folderId = req.params.id;
    const folder = await folderService.getFolderById(folderId);

    if (!folder) {
      res.status(404).json({ message: "Folder not found" });
      return;
    }

    res.status(200).json(folder);
  } catch (error) {
    next(error);
  }
};

type CreateFolderBody = {
  folderName: string;
  userId: string;
  businessId: string;
  parentFolderId?: string | null;
};

/**
 * POST /folder
 */
export const createFolder = async (
  req: Request<{}, {}, CreateFolderBody>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { folderName, userId, businessId, parentFolderId } = req.body;

    const createdFolder = await folderService.createFolder(
      folderName,
      userId,
      businessId,
      parentFolderId ?? null
    );

    res.status(201).json(createdFolder);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /folder/files-folders/:businessId/:folderId?
 */
export const getFilesAndFolders = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const businessId = req.params.businessId;
    const folderId = req.params.folderId;

    const items = await folderService.fetchItemsByFolderId(folderId, businessId);
    res.status(200).json(items);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /folder/:id
 */
export const updateFolder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const folderId = req.params.id;

    // Never allow s3Key updates from this endpoint
    const updatePayload = { ...req.body } as Record<string, unknown>;
    delete updatePayload.s3Key;

    const updatedFolder = await folderService.updateFolder(folderId, updatePayload);

    if (!updatedFolder) {
      res.status(404).json({ message: "Folder not found for update" });
      return;
    }

    res.status(200).json(updatedFolder);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /folder/:id
 */
export const deleteFolder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const folderId = req.params.id;
    const deletedFolder = await folderService.deleteFolder(folderId);

    if (!deletedFolder) {
      res.status(404).json({ message: "Folder not found" });
      return;
    }

    res.status(200).json({ message: "Folder deleted successfully" });
  } catch (error) {
    next(error);
  }
};