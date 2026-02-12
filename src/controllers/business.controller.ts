import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";

import businessService from "../services/business.service";
import { AppError } from "../errors/app.errors";

/**
 * GET /api/business/:id
 * Requires auth.
 */
export const getBusiness = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      throw new AppError({
        message: "Invalid business ID",
        statusCode: 400,
        code: "VALIDATION_ERROR",
      });
    }

    const business = await businessService.getBusinessById(id);
    if (!business) {
      throw new AppError({
        message: "Business not found",
        statusCode: 404,
        code: "BUSINESS_NOT_FOUND",
      });
    }

    return res.status(200).json(business);
  } catch (err) {
    return next(err);
  }
};

/**
 * PUT /api/business/:id
 * Body: { name }
 * Requires auth.
 */
export const updateBusiness = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name } = req.body ?? {};

    if (!Types.ObjectId.isValid(id)) {
      throw new AppError({
        message: "Invalid business ID",
        statusCode: 400,
        code: "VALIDATION_ERROR",
      });
    }

    if (typeof name !== "string" || name.trim().length === 0) {
      throw new AppError({
        message: "Business name is required",
        statusCode: 400,
        code: "VALIDATION_ERROR",
      });
    }

    const updated = await businessService.updateBusiness(id, { name: name.trim() });
    if (!updated) {
      throw new AppError({
        message: "Business not found",
        statusCode: 404,
        code: "BUSINESS_NOT_FOUND",
      });
    }

    return res.status(200).json(updated);
  } catch (err) {
    return next(err);
  }
};