// controllers/permission.controller.ts
import { Request, Response, NextFunction } from 'express';
import PermissionService from '../services/permission.service';

/**
 * ✅ Grant Global Permission
 */
export const grantGlobalPermission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, accessLevel } = req.body;
    const permission = await PermissionService.grantGlobalPermission(userId, accessLevel);
    res.status(201).json(permission);
  } catch (error) {
    next(error);
  }
};

/**
 * ✅ Get Global Permissions for a Specific User
 */
export const getGlobalPermissionsForUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const permissions = await PermissionService.getGlobalPermissions(userId);

    return res.status(200).json(permissions);
  } catch (error) {
    console.error('❌ Error fetching global permissions for user:', error);
    next(error);
  }
};

/**
 * ✅ Get Global Permissions for a Specific User
 */
export const getSpecificPermissionsForUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, targetId } = req.params;
    const permissions = await PermissionService.getSpecificPermissions(userId, targetId);

    return res.status(200).json(permissions);
  } catch (error) {
    console.error('❌ Error fetching global permissions for user:', error);
    next(error);
  }
};


/**
 * ✅ Grant Specific Permission
 */
export const grantSpecificPermission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, targetId, targetType, accessLevel } = req.body;
    const permission = await PermissionService.grantSpecificPermission(userId, targetId, targetType, accessLevel);
    res.status(201).json(permission);
  } catch (error) {
    next(error);
  }
};

/**
 * ✅ Revoke Permission
 */
export const revokePermission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await PermissionService.revokePermission(id);
    res.status(200).json({ message: 'Permission revoked' });
  } catch (error) {
    next(error);
  }
};

/**
 * ✅ List Permissions for Target
 */
export const listPermissionsForTarget = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { targetId } = req.params;
    const permissions = await PermissionService.listPermissionsForTarget(targetId);
    res.status(200).json(permissions);
  } catch (error) {
    next(error);
  }
};