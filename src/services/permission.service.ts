import { Folder } from '../models/folder.model';
import { File } from '../models/file.model';
import { Permission, IPermission } from '../models/permission.model';
import { Types } from 'mongoose';

/** Access levels supported by the system */
type AccessLevel = 'read' | 'write' | 'create' | 'delete' | 'owner';

/** Accepts either a single access level or an array of access levels */
type AccessLevelInput = AccessLevel | AccessLevel[];

/**
 * ✅ Permission Service
 * Handles global and specific permissions for users, files, and folders.
 */
class PermissionService {
  /**
   * ✅ Validate Access Level
   * Ensures that the provided access levels are valid.
   * @param accessLevel - Access level(s) to validate (string or array)
   * @returns boolean
   */
  private validateAccessLevel(accessLevel: AccessLevelInput): boolean {
    const validAccessLevels: AccessLevel[] = ['read', 'write', 'create', 'delete', 'owner'];
    if (Array.isArray(accessLevel)) {
      return accessLevel.every(level => validAccessLevels.includes(level));
    }
    return validAccessLevels.includes(accessLevel);
  }

/**
 * ✅ Grant Global Permission
 * Grants global permissions to a user for all files and folders.
 * @param userId - User ID
 * @param accessLevel - Single access level or array of access levels
 * @returns {Promise<IPermission>}
 */
async grantGlobalPermission(userId: string, accessLevel: AccessLevel | AccessLevel[]): Promise<IPermission> {
  if (!Types.ObjectId.isValid(userId)) {
    throw new Error('❌ Invalid user ID');
  }

  if (!this.validateAccessLevel(accessLevel)) {
    throw new Error('❌ Invalid access level(s)');
  }

  const accessLevels: AccessLevel[] = Array.isArray(accessLevel) ? accessLevel : [accessLevel];

  // Check for existing global permission
  let existingPermission = await Permission.findOne({ userId, isGlobal: true });

  if (existingPermission) {
    existingPermission.accessLevel = accessLevels;
    return await existingPermission.save();
  }

  // Create new global permission
  return await Permission.create({
    userId,
    accessLevel: accessLevels,
    isGlobal: true,
  });
}

/**
 * ✅ Grant Specific Permission
 * Grants permission for a specific file or folder.
 * @param userId - User ID
 * @param targetId - Target File/Folder ID
 * @param targetType - 'file' | 'folder'
 * @param accessLevel - Single or array of access levels
 * @returns {Promise<IPermission>}
 */
async grantSpecificPermission(
  userId: string,
  targetId: string,
  targetType: 'file' | 'folder',
  accessLevel: AccessLevel | AccessLevel[]
): Promise<IPermission> {
  if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(targetId)) {
    throw new Error('❌ Invalid user ID or target ID');
  }

  if (!this.validateAccessLevel(accessLevel)) {
    throw new Error('❌ Invalid access level(s)');
  }

  const accessLevels: AccessLevel[] = Array.isArray(accessLevel) ? accessLevel : [accessLevel];

  const existingPermission = await Permission.findOne({ userId, targetId, targetType });
  if (existingPermission) {
    existingPermission.accessLevel = accessLevels;
    await existingPermission.save();
  } else {
    await Permission.create({
      userId,
      targetId,
      targetType,
      accessLevel: accessLevels,
      isGlobal: false,
    });
  }

  // ✅ If target is a folder, propagate permissions recursively
  if (targetType === 'folder') {
    await this.propagatePermissions(userId, targetId, accessLevels);
  }

  return Permission.findOne({ userId, targetId, targetType }) as Promise<IPermission>;
}

/**
 * Recursively propagates permissions from a folder to all nested folders and files.
 * @param userId The user who is being granted the permissions.
 * @param folderId The folder whose permissions are being propagated.
 * @param accessLevels The access levels to grant.
 */
async propagatePermissions(userId: string, folderId: string, accessLevels: AccessLevel[]): Promise<void> {
  // ✅ Get all nested folders and files, including subfolder files
  const nestedItems = await this.getAllNestedFoldersAndFiles(folderId);

  // ✅ Prepare bulk operations for efficient updates
  const bulkOperations = nestedItems.map(item => ({
    updateOne: {
      filter: { userId, targetId: item._id, targetType: item.type },
      update: { $set: { accessLevel: accessLevels, isGlobal: false } },
      upsert: true, // Insert if not exists
    },
  }));

  if (bulkOperations.length > 0) {
    await Permission.bulkWrite(bulkOperations);
  }
}

/**
 * Retrieves all nested folders and files under a given folder ID recursively.
 * Uses MongoDB's aggregation pipeline for efficient querying.
 * @param folderId The folder to retrieve all nested contents for.
 * @returns An array of folders and files with their respective types.
 */
async getAllNestedFoldersAndFiles(folderId: string): Promise<{ _id: Types.ObjectId; type: 'file' | 'folder' }[]> {
  // Get all nested folders recursively
  const folders = await Folder.aggregate([
    {
      $match: { _id: new Types.ObjectId(folderId) },
    },
    {
      $graphLookup: {
        from: 'folders',
        startWith: '$_id',
        connectFromField: '_id',
        connectToField: 'parentFolderId',
        as: 'nestedFolders',
      },
    },
    {
      $unwind: '$nestedFolders',
    },
    {
      $project: {
        _id: '$nestedFolders._id',
        type: { $literal: 'folder' },
      },
    },
  ]);

  // Get all files from the retrieved folders, including the root folder
  const allFolderIds = [folderId, ...folders.map(f => f._id)]; // Include root folder
  const files = await File.find({ folderId: { $in: allFolderIds } }).select('_id').lean();

  return [
    ...folders,
    ...files.map(file => ({ _id: file._id, type: 'file' })),
  ];
}
// async grantSpecificPermission(
//   userId: string,
//   targetId: string,
//   targetType: 'file' | 'folder',
//   accessLevel: AccessLevel | AccessLevel[]
// ): Promise<IPermission> {
//   if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(targetId)) {
//     throw new Error('❌ Invalid user ID or target ID');
//   }
//   // console.log(accessLevel)
//   if (!this.validateAccessLevel(accessLevel)) {
//     throw new Error('❌ Invalid access level(s)');
//   }

//   const accessLevels: AccessLevel[] = Array.isArray(accessLevel) ? accessLevel : [accessLevel];

//   const existingPermission = await Permission.findOne({ userId, targetId, targetType });
//   if (existingPermission) {
//     existingPermission.accessLevel = accessLevels;
//     return await existingPermission.save();
//   }

//   return await Permission.create({
//     userId,
//     targetId,
//     targetType,
//     accessLevel: accessLevels,
//     isGlobal: false,
//   });
// }
  /**
   * ✅ Get Global Permissions for a User
   * Fetches global permissions for a specific user.
   * @param userId - User ID
   * @returns {Promise<IPermission | null>}
   */
  async getGlobalPermissions(userId: string): Promise<IPermission | null> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('❌ Invalid user ID');
    }

    return await Permission.findOne({ userId, isGlobal: true });
  }


/**
 * ✅ Get Specific Permissions for a User on a Target
 * Fetches specific permissions for a user on a given file or folder.
 * @param userId - User ID
 * @param targetId - Target File/Folder ID
 * @returns {Promise<IPermission | null>}
 */
async getSpecificPermissions(userId: string, targetId: string): Promise<IPermission | null> {
  // console.log(`🔍 Checking permissions for user: ${userId}, target: ${targetId}`);

  if (!Types.ObjectId.isValid(userId)) {
    console.error(`❌ Invalid user ID: ${userId}`);
    return null; // Return null instead of throwing an error
  }

  if (!Types.ObjectId.isValid(targetId)) {
    console.error(`❌ Invalid target ID: ${targetId}`);
    return null;
  }

  try {
    const permission = await Permission.findOne({ userId, targetId });
    
    if (!permission) {
      //console.log(`ℹ️ No specific permissions found for user ${userId} on target ${targetId}`);
    }

    return permission;
  } catch (error) {
    console.error(`❌ Error fetching specific permissions:`, error);
    throw new Error('Internal Server Error');
  }
}

  /**
   * ✅ Get Specific Permissions
   * Fetches permissions for a specific target (file/folder) and user.
   * @param userId - User ID
   * @param targetId - Target File/Folder ID
   * @param targetType - 'file' | 'folder'
   * @returns {Promise<IPermission | null>}
   */
  async getSpecificPermission(
    userId: string,
    targetId: string,
    targetType: 'file' | 'folder'
  ): Promise<IPermission | null> {
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(targetId)) {
      throw new Error('❌ Invalid user ID or target ID');
    }

    return await Permission.findOne({ userId, targetId, targetType });
  }

  /**
   * ✅ Revoke Permission
   * Removes a specific permission entry.
   * @param permissionId - Permission ID
   * @returns {Promise<void>}
   */
  async revokePermission(permissionId: string): Promise<void> {
    if (!Types.ObjectId.isValid(permissionId)) {
      throw new Error('❌ Invalid permission ID');
    }

    await Permission.findByIdAndDelete(permissionId);
  }

  /**
   * ✅ List Permissions for a Target
   * Lists all permissions for a specific file or folder.
   * @param targetId - Target ID
   * @returns {Promise<IPermission[]>}
   */
  async listPermissionsForTarget(targetId: string): Promise<IPermission[]> {
    if (!Types.ObjectId.isValid(targetId)) {
      throw new Error('❌ Invalid target ID');
    }

    return await Permission.find({ targetId });
  }

  /**
   * ✅ List Permissions for a User
   * Lists all permissions (both global and specific) for a specific user.
   * @param userId - User ID
   * @returns {Promise<IPermission[]>}
   */
  async listPermissionsForUser(userId: string): Promise<IPermission[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('❌ Invalid user ID');
    }

    return await Permission.find({ userId });
  }
}

export default new PermissionService();