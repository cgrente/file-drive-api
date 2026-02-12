import { Types } from "mongoose";
import { File, type FileHydrated, type FileLean, type FileSchemaType } from "../models/file.model";
import { Folder, type FolderLean } from "../models/folder.model";
import S3Service from "./s3.service";
import folderService from "./folder.service";
import { User } from "../models/user.model";

function sanitizeFilename(originalName: string): string {
  // Keep it simple, safe, predictable (avoid weird keys)
  return originalName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
}

function rootPrefix(businessId: string): string {
  // Root “folder” prefix for files that are not in a folder
  return `${businessId}/root/`;
}

type FileWithDownloadUrl = FileLean & { downloadUrl?: string };

type FileWithUsernameAndUrl = FileLean & {
  username: string;
  downloadUrl?: string;
};

class FileService {
  async getAllFiles(): Promise<FileLean[]> {
    return File.find().lean<FileLean[]>();
  }

  async getFileById(id: string): Promise<FileWithDownloadUrl | null> {
    if (!Types.ObjectId.isValid(id)) throw new Error("Invalid file ID");

    const file = await File.findById(id).lean<FileLean>();
    if (!file) throw new Error("File not found");

    const downloadUrl = file.s3Key
      ? await S3Service.presignDownload(file.s3Key)
      : undefined;

    return { ...file, downloadUrl };
  }

  /**
   * Best-practice presigned upload start:
   * - server decides s3Key (stable, ID-based)
   * - returns PUT URL + the fileId to use in `completeUpload`
   */
  async startUpload(params: {
    businessId: string;
    userId: string;
    folderId?: string | null;
    fileName: string;
    fileSize: number;
    contentType?: string;
  }): Promise<{
    fileId: string;
    s3Key: string;
    uploadUrl: string;
    normalizedFileName: string;
  }> {
    const { businessId, userId, folderId, fileName, fileSize, contentType } = params;

    if (!Types.ObjectId.isValid(businessId)) throw new Error("Invalid businessId");
    if (!Types.ObjectId.isValid(userId)) throw new Error("Invalid userId");
    if (!fileName || typeof fileName !== "string") throw new Error("Invalid fileName");
    if (typeof fileSize !== "number" || fileSize < 0) throw new Error("Invalid fileSize");

    const normalizedFileName = sanitizeFilename(fileName.trim());

    // Generate fileId now so key is stable
    const fileId = new Types.ObjectId();

    let keyPrefix = rootPrefix(businessId);

    if (folderId) {
      if (!Types.ObjectId.isValid(folderId)) throw new Error("Invalid folderId");

      const folder = await Folder.findById(folderId).lean<FolderLean>();
      if (!folder) throw new Error("Folder not found");

      keyPrefix = folder.s3Key; // folder prefix ends with "/"
    }

    // Stable key: prefix + files/<fileId>-<name>
    const s3Key = `${keyPrefix}files/${fileId.toString()}-${normalizedFileName}`;

    const uploadUrl = await S3Service.presignUpload({
      key: s3Key,
      contentType,
      expiresInSeconds: 3600,
    });

    return {
      fileId: fileId.toString(),
      s3Key,
      uploadUrl,
      normalizedFileName,
    };
  }

  /**
   * After client PUTs bytes to S3, they call completeUpload to write metadata to Mongo.
   * This keeps DB consistent with what was uploaded.
   */
  async completeUpload(params: {
    fileId: string;
    userId: string;
    businessId: string;
    folderId?: string | null;
    fileName: string;
    fileSize: number;
    contentType?: string;
    s3Key: string;
  }): Promise<FileHydrated> {
    const {
      fileId,
      userId,
      businessId,
      folderId,
      fileName,
      fileSize,
      contentType,
      s3Key,
    } = params;

    if (!Types.ObjectId.isValid(fileId)) throw new Error("Invalid fileId");
    if (!Types.ObjectId.isValid(userId)) throw new Error("Invalid userId");
    if (!Types.ObjectId.isValid(businessId)) throw new Error("Invalid businessId");
    if (folderId && !Types.ObjectId.isValid(folderId)) throw new Error("Invalid folderId");
    if (!s3Key) throw new Error("Missing s3Key");

    const newFileDocument = new File({
      _id: new Types.ObjectId(fileId),
      userId: new Types.ObjectId(userId),
      businessId: new Types.ObjectId(businessId),
      folderId: folderId ? new Types.ObjectId(folderId) : null,
      fileName: sanitizeFilename(fileName.trim()),
      fileSize,
      contentType: contentType ?? null,
      s3Key,
    }) as FileHydrated;

    const savedFile = await newFileDocument.save();

    // Keep your folder.fileIds relationship if you want it
    if (folderId) {
      // IMPORTANT: savedFile._id is a real ObjectId here (not unknown)
      await folderService.addFileToFolder(savedFile._id.toString(), folderId.toString());
    }

    return savedFile;
  }

  async getFilesAccessibleByUser(
    userId: string,
    businessId: string,
    folderId?: string
  ): Promise<Array<Record<string, unknown>>> {
    if (!Types.ObjectId.isValid(userId)) throw new Error("Invalid userId");
    if (!Types.ObjectId.isValid(businessId)) throw new Error("Invalid businessId");

    const query: Record<string, unknown> = { businessId: new Types.ObjectId(businessId) };
    query.folderId =
      folderId && Types.ObjectId.isValid(folderId) ? new Types.ObjectId(folderId) : null;

    const files = await File.aggregate([
      { $match: query },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      {
        $unwind: {
          path: "$user",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          fileName: 1,
          businessId: 1,
          createdAt: 1,
          updatedAt: 1,
          folderId: 1,
          fileSize: 1,
          contentType: 1,
          s3Key: 1,
          userId: 1,
          user: {
            username: 1,
            email: 1,
            role: 1,
          },
        },
      },
      { $sort: { fileName: 1 } },
    ]);

    return Promise.all(
      files.map(async (fileRecord) => ({
        ...fileRecord,
        downloadUrl: fileRecord.s3Key
          ? await S3Service.presignDownload(String(fileRecord.s3Key))
          : undefined,
      }))
    );
  }

  async getFilesByBusinessId(
    businessId: string,
    folderId?: string
  ): Promise<FileWithUsernameAndUrl[]> {
    if (!Types.ObjectId.isValid(businessId)) throw new Error("Invalid businessId");

    const query: Record<string, unknown> = { businessId: new Types.ObjectId(businessId) };
    query.folderId =
      folderId && Types.ObjectId.isValid(folderId) ? new Types.ObjectId(folderId) : null;

    const files = await File.find(query).lean<FileLean[]>();
    if (!files.length) return [];

    const uniqueUserIdStrings = [...new Set(files.map((fileDoc) => fileDoc.userId.toString()))];

    const users = await User.find({ _id: { $in: uniqueUserIdStrings } })
      .select("username")
      .lean<Array<{ _id: Types.ObjectId; username: string }>>();

    const usernameByUserId = new Map(users.map((userDoc) => [userDoc._id.toString(), userDoc.username]));

    return Promise.all(
      files.map(async (fileDoc) => ({
        ...fileDoc,
        username: usernameByUserId.get(fileDoc.userId.toString()) ?? "Unknown User",
        downloadUrl: fileDoc.s3Key ? await S3Service.presignDownload(fileDoc.s3Key) : undefined,
      }))
    );
  }

  /**
   * Legacy helper.
   * Prefer startUpload/completeUpload so the server decides s3Key and you never
   * risk a "DB says file exists but S3 doesn't" mismatch.
   */
  async createFile(fileData: Partial<FileSchemaType>): Promise<FileHydrated> {
    if (!fileData.userId || !fileData.fileName || !fileData.businessId || !fileData.s3Key) {
      throw new Error("Missing required file data (userId, fileName, businessId, s3Key).");
    }

    const fileDocument = new File(fileData) as FileHydrated;
    const savedFile = await fileDocument.save();

    if (fileData.folderId) {
      await folderService.addFileToFolder(savedFile._id.toString(), fileData.folderId.toString());
    }

    return savedFile;
  }

  async updateFile(id: string, fileData: Partial<FileSchemaType>): Promise<FileLean | null> {
    if (!Types.ObjectId.isValid(id)) throw new Error("Invalid file ID");

    // Best practice:
    // - rename => update fileName only (do NOT move S3 object)
    // - move folder => update folderId only (do NOT move S3 object)
    // - never allow s3Key changes via update
    const { s3Key: _ignoreS3Key, ...safeUpdate } = fileData as Record<string, unknown>;

    const updated = await File.findByIdAndUpdate(id, safeUpdate, { new: true }).lean<FileLean>();
    return updated ?? null;
  }

  async deleteFile(id: string): Promise<FileLean | null> {
    if (!Types.ObjectId.isValid(id)) throw new Error("Invalid file ID");

    const fileDocument = await File.findById(id);
    if (!fileDocument) throw new Error("File not found for deletion");

    // unlink from folder fileIds if you keep that relationship
    if (fileDocument.folderId) {
      await Folder.findByIdAndUpdate(
        fileDocument.folderId,
        { $pull: { fileIds: new Types.ObjectId(id) } },
        { new: true }
      );
    }

    // delete from S3 first
    if (fileDocument.s3Key) {
      await S3Service.deleteObject(fileDocument.s3Key);
    }

    const deleted = await File.findByIdAndDelete(id).lean<FileLean>();
    return deleted ?? null;
  }
}

export default new FileService();