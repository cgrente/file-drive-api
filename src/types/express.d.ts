// src/types/express.d.ts
import type { IUser } from "../models/user.model";
import type { AuthContext } from "../middleware/auth.middleware";

declare global {
  namespace Express {
    interface Request {
      /**
       * Correlation id for tracing a request across logs/services.
       */
      requestId?: string;

      /**
       * Authentication context attached by auth middleware.
       */
      auth?: AuthContext;

      /**
       * User attached by auth middleware.
       */
      user?: IUser;
    }
  }
}

export {};