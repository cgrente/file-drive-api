import { Types } from "mongoose";

export type CreateBusinessInput = {
  name: string;
  ownerId: Types.ObjectId;
  status?: "active" | "inactive";
  description?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  contact?: {
    phone?: string;
    email?: string;
  };
  website?: string;
  industry?: string;
};