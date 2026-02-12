import express, { type Application, type Request, type Response, type NextFunction } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import { corsMiddleware } from "./middleware/cors.middleware";
import { rateLimiter } from "./middleware/rate-limit.middleware";
import { logging } from "./middleware/logging.middleware";
import { requestId } from "./middleware/request-id.middleware";
import { errorHandler } from "./middleware/error-handler.middleware";

import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import fileRoutes from "./routes/file.routes";
import permissionRoutes from "./routes/permission.routes";
import folderRoutes from "./routes/folder.routes";
import paymentRoutes from "./routes/payment.routes";
import businessRoutes from "./routes/business.routes";
import subscriptionRoutes from "./routes/subscription.routes";
import notificationRoutes from "./routes/notification.routes";
import adminRoutes from "./routes/admin.routes";
import healthRoutes from "./routes/health.routes";

const app: Application = express();

/**
 * Request ID + logging (first)
 */
app.use(requestId);
app.use(logging);

/**
 * Security & CORS
 */
app.use(corsMiddleware);
app.use(helmet());
app.use(cookieParser());

// Trust first proxy (Nginx / LB)
app.set("trust proxy", 1);

/**
 * Rate limiting (Redis-backed)
 */
app.use(rateLimiter);

/**
 * ✅ Stripe webhook requires RAW body ONLY on that route.
 * This MUST come BEFORE express.json() or the signature verification breaks.
 */
app.use("/api/payment/webhook", express.raw({ type: "application/json" }));

/**
 * JSON / URL-encoded
 * Keep JSON bodies small; large uploads should go through multer or S3 presigned URLs
 */
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ limit: "2mb", extended: true }));

/**
 * Routes
 */
app.use("/api", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/file", fileRoutes);
app.use("/api/folder", folderRoutes);
app.use("/api/business", businessRoutes);
app.use("/api/permission", permissionRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/notification", notificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payment", paymentRoutes);

/**
 * 404 handler
 */
app.use((req: Request, _res: Response, next: NextFunction) => {
  return next(new Error("❌ Route not found"));
});

/**
 * Global error handler
 */
app.use(errorHandler);

export default app;