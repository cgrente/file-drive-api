import { Types } from "mongoose";
import { AppError } from "../errors/app.errors";
import { BusinessModel, type BusinessDocument } from "../models/business.model";
import { CreateBusinessInput } from "../types/business.types";

class BusinessService {
  /**
   * Create a new business.
   */
  async createBusiness(data: CreateBusinessInput): Promise<BusinessDocument> {
    try {
      const business = new BusinessModel(data);
      return await business.save();
    } catch (cause) {
      throw new AppError({
        message: "Failed to create business",
        statusCode: 500,
        code: "BUSINESS_CREATE_FAILED",
        cause,
      });
    }
  }

  /**
   * Get business by id.
   */
  async getBusinessById(id: string | Types.ObjectId): Promise<BusinessDocument | null> {
    try {
      return await BusinessModel.findById(id);
    } catch (cause) {
      throw new AppError({
        message: "Failed to fetch business",
        statusCode: 500,
        code: "BUSINESS_FETCH_FAILED",
        cause,
      });
    }
  }

  /**
   * Update business by id.
   */
  async updateBusiness(
    id: string | Types.ObjectId,
    updateData: Partial<{ name: string }>
  ): Promise<BusinessDocument | null> {
    try {
      return await BusinessModel.findByIdAndUpdate(id, updateData, { new: true });
    } catch (cause) {
      throw new AppError({
        message: "Failed to update business",
        statusCode: 500,
        code: "BUSINESS_UPDATE_FAILED",
        cause,
      });
    }
  }
}

export default new BusinessService();