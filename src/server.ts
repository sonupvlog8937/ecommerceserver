import "dotenv/config";
import express from "express";
import { connectDB } from "./db.js";
import cors from "cors";
import morgan from "morgan";
import { ok } from "./utils/envelope.js";
import { notFound } from "./middleware/notFound.js";
import { errorHandler } from "./middleware/errorhandler.js";
import { clerkMiddleware } from "@clerk/express";
import { authRouter } from "./routes/auth/auth.routes.js";
import { adminProductRouter } from "./routes/admin/product.routes.js";
import { customerProductRouter } from "./routes/customer/product.routes.js";
import { customerAddressRouter } from "./routes/customer/address.routes.js";
import { adminPromoRouter } from "./routes/admin/promo.routes.js";
import { customerPromoRouter } from "./routes/customer/promo.routes.js";
import { customerCartWishlistRouter } from "./routes/customer/cart-wishlist.routes.js";
import { customerCheckoutRouter } from "./routes/customer/checkout.routes.js";
import { customerOrderRouter } from "./routes/customer/orders.routes.js";
import { customerCheckoutWithPointsRouter } from "./routes/customer/checkout-with-points.routes.js";
import { adminOrderRouter } from "./routes/admin/orders.routes.js";
import { adminSettingsRouter } from "./routes/admin/settings.routes.js";
import { adminDashboardRouter } from "./routes/admin/dashboard.routes.js";
import { customerHomeRouter } from "./routes/customer/home.routes.js";
import customerReviewRouter from "./routes/customer/reviews.js";
import adminSpecificationRouter from "./routes/admin/specifications.js";

async function mainEntryFunction() {
  await connectDB();

  const app = express();

  const corsOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
    }),
  );

  app.use(express.json());
  app.use(morgan("dev"));
  app.use(clerkMiddleware());

  app.get("/health", (_req, res) => {
    res.status(200).json(ok({ message: "Server is healthy/in running state" }));
  });

  // auth routes
  app.use("/auth", authRouter);

  // customer routes
  app.use("/customer", customerHomeRouter);
  app.use("/customer", customerProductRouter);
  app.use("/customer", customerAddressRouter);
  app.use("/customer", customerPromoRouter);
  app.use("/customer", customerCartWishlistRouter);
  app.use("/customer", customerCheckoutRouter);
  app.use("/customer", customerCheckoutWithPointsRouter);
  app.use("/customer", customerOrderRouter);
  app.use("/customer/reviews", customerReviewRouter);

  // admin routes
  app.use("/admin", adminProductRouter);
  app.use("/admin", adminPromoRouter);
  app.use("/admin", adminOrderRouter);
  app.use("/admin", adminSettingsRouter);
  app.use("/admin", adminDashboardRouter);
  app.use("/admin/specifications", adminSpecificationRouter);

  app.use(notFound);
  app.use(errorHandler);

  const port = Number(process.env.PORT || 5000);

  app.listen(port, () => {
    console.log(`Server is now listening to port ${port}`);
  });
}

mainEntryFunction().catch((err) => {
  console.error("failed to start", err);
  process.exit(1);
});
