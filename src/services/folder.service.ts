import { Types } from "mongoose";
import S3Service from "./s3.service";

import { Folder, type FolderLean, type FolderSchemaType } from "../models/folder.model";
import { File } from "../models/file.model";
import { User } from "../models/user.model";

/**
 * Sanitizes folder names for display + storage.
 * Keeps it predictable and safe across file systems + URLs.
 */
function sanitizeFolderName(folderName: string): string {
  return folderName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

/**
 * S3 folder prefix (must end with "/")
 */
function folderPrefix(businessId: string, folderId: string): string {
  return `${businessId}/folders/${folderId}/`;
}

/**
 * Types for the aggregate payload returned to the UI.
 * (Aggregate pipelines do NOT return mongoose docs.)
 */
type FolderListItem = {
  _id: Types.ObjectId;
  folderName: string;
  businessId: Types.ObjectId;
  parentFolderId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
  s3Key: string;
  fileCount: number;
  userId: Types.ObjectId;
  user?: { _id: Types.ObjectId; username?: string; email?: string } | null;
};

type FileListItem = {
  _id: Types.ObjectId;
  fileName: string;
  businessId: Types.ObjectId;
  folderId: Types.ObjectId | null;
  fileSize: number;
  contentType?: string | null;
  createdAt: Date;
  updatedAt: Date;
  s3Key: string;
  userId: Types.ObjectId;
  user?: { _id: Types.ObjectId; username?: string; email?: string } | null;
};

type SignedFileListItem = FileListItem & { downloadUrl?: string };

class FolderService {
  /**
   * Prefer to avoid this endpoint in production (it can become huge).
   * If you keep it, return lean objects.
   */
  async getAllFolders(): Promise<FolderLean[]> {
    return Folder.find().lean<FolderLean[]>();
  }

  /**
   * Fetch immediate child folders + files under a folderId (or root when folderId undefined/null).
   * Adds signed URLs only for files.
   */
  async fetchItemsByFolderId(
    folderId: string | undefined,
    businessId: string
  ): Promise<{ folders: FolderListItem[]; files: SignedFileListItem[] }> {
    if (!Types.ObjectId.isValid(businessId)) throw new Error("Invalid businessId");
    if (folderId && !Types.ObjectId.isValid(folderId)) throw new Error("Invalid folderId");

    const businessObjectId = new Types.ObjectId(businessId);
    const parentFolderObjectId = folderId ? new Types.ObjectId(folderId) : null;

    const folders = await Folder.aggregate<FolderListItem>([
      {
        $match: {
          businessId: businessObjectId,
          parentFolderId: parentFolderObjectId,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          fileCount: {
            $sum: [
              { $size: { $ifNull: ["$fileIds", []] } },
              { $size: { $ifNull: ["$folderIds", []] } },
            ],
          },
        },
      },
      {
        $project: {
          _id: 1,
          folderName: 1,
          businessId: 1,
          parentFolderId: 1,
          createdAt: 1,
          updatedAt: 1,
          s3Key: 1,
          fileCount: 1,
          userId: 1,
          user: { _id: 1, username: 1, email: 1 },
        },
      },
      { $sort: { folderName: 1 } },
    ]);

    const files = await File.aggregate<FileListItem>([
      {
        $match: {
          businessId: businessObjectId,
          folderId: parentFolderObjectId,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          fileName: 1,
          businessId: 1,
          folderId: 1,
          fileSize: 1,
          contentType: 1,
          createdAt: 1,
          updatedAt: 1,
          s3Key: 1,
          userId: 1,
          user: { _id: 1, username: 1, email: 1 },
        },
      },
      { $sort: { fileName: 1 } },
    ]);

    const signedFiles = await Promise.all(
      files.map(async (fileItem): Promise<SignedFileListItem> => {
        const downloadUrl = fileItem.s3Key
          ? await S3Service.presignDownload(fileItem.s3Key)
          : undefined;

        return { ...fileItem, downloadUrl };
      })
    );

    return { folders, files: signedFiles };
  }

  async getFoldersByUserId(userId: string): Promise<FolderLean[]> {
    if (!Types.ObjectId.isValid(userId)) throw new Error("Invalid user ID");
    return Folder.find({ userId: new Types.ObjectId(userId) }).lean<FolderLean[]>();
  }

  async getFoldersByBusinessId(
    businessId: string,
    folderId?: string
  ): Promise<Array<FolderLean & { username: string }>> {
    if (!Types.ObjectId.isValid(businessId)) throw new Error("Invalid business ID");

    const query: Record<string, unknown> = { businessId: new Types.ObjectId(businessId) };
    if (folderId && Types.ObjectId.isValid(folderId)) {
      query._id = new Types.ObjectId(folderId);
    }

    const folders = await Folder.find(query).lean<FolderLean[]>();
    if (folders.length === 0) return [];

    const uniqueUserIds = [...new Set(folders.map((folder) => folder.userId.toString()))];

    const users = await User.find({ _id: { $in: uniqueUserIds } })
      .select("username")
      .lean<{ _id: Types.ObjectId; username?: string }[]>();

    const userMap = new Map(users.map((user) => [user._id.toString(), user.username ?? "Unknown User"]));

    return folders.map((folder) => ({
      ...folder,
      username: userMap.get(folder.userId.toString()) ?? "Unknown User",
    }));
  }

  async getFolderById(id: string): Promise<FolderLean | null> {
    if (!Types.ObjectId.isValid(id)) throw new Error("Invalid folder ID.");
    return Folder.findById(id).lean<FolderLean | null>();
  }

  async addChildFolderToFolder(parentFolderId: string, childFolderId: string): Promise<void> {
    const parentFolderObjectId = new Types.ObjectId(parentFolderId);
    const childFolderObjectId = new Types.ObjectId(childFolderId);

    const parentFolderDoc = await Folder.findById(parentFolderObjectId);
    if (!parentFolderDoc) throw new Error(`Parent folder with ID ${parentFolderId} not found.`);

    const alreadyLinked = (parentFolderDoc.folderIds ?? []).some((existingId) =>
      existingId.equals(childFolderObjectId)
    );
    if (alreadyLinked) return;

    parentFolderDoc.folderIds = [...(parentFolderDoc.folderIds ?? []), childFolderObjectId];
    await parentFolderDoc.save();
  }

  async removeChildFolderFromFolder(parentFolderId: string, childFolderId: string): Promise<void> {
    const parentFolderObjectId = new Types.ObjectId(parentFolderId);
    const childFolderObjectId = new Types.ObjectId(childFolderId);

    const parentFolderDoc = await Folder.findById(parentFolderObjectId);
    if (!parentFolderDoc) throw new Error(`Parent folder with ID ${parentFolderId} not found.`);

    parentFolderDoc.folderIds = (parentFolderDoc.folderIds ?? []).filter(
      (existingId) => !existingId.equals(childFolderObjectId)
    );
    await parentFolderDoc.save();
  }

  async addFileToFolder(fileId: string, folderId: string): Promise<void> {
    const fileObjectId = new Types.ObjectId(fileId);
    const folderObjectId = new Types.ObjectId(folderId);

    const updatedFolder = await Folder.findOneAndUpdate(
      { _id: folderObjectId },
      { $addToSet: { fileIds: fileObjectId } },
      { new: true }
    );

    if (!updatedFolder) throw new Error(`Folder with ID ${folderId} not found.`);
  }

  /**
   * Create folder:
   * - generate folderId upfront
   * - set s3Key prefix = businessId/folders/<folderId>/
   * - save mongo
   * - update parent folder folderIds
   *
   * (No S3 calls needed here.)
   */
  async createFolder(
    folderName: string,
    userId: string,
    businessId: string,
    parentFolderId: string | null
  ): Promise<FolderLean> {
    if (!folderName || !userId || !businessId) {
      throw new Error("User ID, Business ID, and Folder Name are required.");
    }
    if (!Types.ObjectId.isValid(userId)) throw new Error("Invalid userId");
    if (!Types.ObjectId.isValid(businessId)) throw new Error("Invalid businessId");
    if (parentFolderId && !Types.ObjectId.isValid(parentFolderId)) throw new Error("Invalid parentFolderId");

    const normalizedName = sanitizeFolderName(folderName.trim());
    const newFolderId = new Types.ObjectId();

    const exists = await Folder.findOne({
      businessId: new Types.ObjectId(businessId),
      parentFolderId: parentFolderId ? new Types.ObjectId(parentFolderId) : null,
      folderName: normalizedName,
    }).lean<FolderLean | null>();

    if (exists) {
      throw new Error(`A folder named "${normalizedName}" already exists in this location.`);
    }

    const prefix = folderPrefix(businessId, newFolderId.toString());

    const folderDoc = new Folder({
      _id: newFolderId,
      folderName: normalizedName,
      userId: new Types.ObjectId(userId),
      businessId: new Types.ObjectId(businessId),
      parentFolderId: parentFolderId ? new Types.ObjectId(parentFolderId) : null,
      s3Key: prefix,
      fileIds: [],
      folderIds: [],
    });

    await folderDoc.save();

    if (parentFolderId) {
      // ✅ Fix for your "'_id' is unknown" issue:
      // we don't rely on saved._id typing; we already have newFolderId.
      await this.addChildFolderToFolder(parentFolderId, newFolderId.toString());
    }

    const created = await Folder.findById(newFolderId).lean<FolderLean | null>();
    if (!created) throw new Error("Folder creation failed.");
    return created;
  }

  /**
   * Rename folder = DB update only (no S3 move).
   */
  async updateFolder(id: string, folderData: Partial<FolderSchemaType>): Promise<FolderLean | null> {
    if (!Types.ObjectId.isValid(id)) throw new Error("Invalid folder ID");

    const update: Partial<FolderSchemaType> = { ...folderData };

    if (update.folderName) {
      update.folderName = sanitizeFolderName(update.folderName.trim());
    }

    // Never change s3Key on rename
    delete (update as Partial<FolderSchemaType> & { s3Key?: string }).s3Key;

    return Folder.findByIdAndUpdate(id, update, { new: true }).lean<FolderLean | null>();
  }

  /**
   * Delete folder subtree:
   * - delete S3 prefix ONCE per folder
   * - delete files under subtree in Mongo
   * - delete folders under subtree in Mongo
   */
  async deleteFolder(id: string): Promise<FolderLean | null> {
    if (!Types.ObjectId.isValid(id)) throw new Error("Invalid folder ID");

    const rootFolder = await Folder.findById(id).lean<FolderLean | null>();
    if (!rootFolder) throw new Error("Folder not found in the database");

    // 1) Delete S3 objects under this folder prefix
    await S3Service.deletePrefix(rootFolder.s3Key);

    // 2) Delete files directly in this folder
    await File.deleteMany({ folderId: new Types.ObjectId(id) });

    // 3) Walk subtree
    const folderIdStack: string[] = (rootFolder.folderIds ?? []).map((childFolderObjectId) =>
      childFolderObjectId.toString()
    );

    while (folderIdStack.length) {
      const childFolderId = folderIdStack.pop()!;
      const childFolder = await Folder.findById(childFolderId).lean<FolderLean | null>();
      if (!childFolder) continue;

      await S3Service.deletePrefix(childFolder.s3Key);
      await File.deleteMany({ folderId: new Types.ObjectId(childFolderId) });

      for (const nestedFolderObjectId of childFolder.folderIds ?? []) {
        folderIdStack.push(nestedFolderObjectId.toString());
      }

      await Folder.findByIdAndDelete(childFolderId);
    }

    // unlink from parent.folderIds
    if (rootFolder.parentFolderId) {
      await Folder.findByIdAndUpdate(rootFolder.parentFolderId, {
        $pull: { folderIds: new Types.ObjectId(id) },
      });
    }

    return Folder.findByIdAndDelete(id).lean<FolderLean | null>();
  }

  /**
   * Legacy helper (kept because you referenced it elsewhere).
   */
  async getFolderByName(
    businessId: string,
    folderName: string,
    parentFolderId?: string
  ): Promise<FolderLean | null> {
    const query = {
      businessId: new Types.ObjectId(businessId),
      folderName,
      parentFolderId: parentFolderId ? new Types.ObjectId(parentFolderId) : null,
    };

    return Folder.findOne(query).lean<FolderLean | null>();
  }
}

export default new FolderService();