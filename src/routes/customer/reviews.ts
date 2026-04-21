import { Router, Request, Response } from "express";
import { Types } from "mongoose";
import { asyncHandler } from "../../utils/asyncHandler";
import { AppError } from "../../utils/AppError";
import { ReviewModel } from "../../models/Review";
import { Product } from "../../models/Product";
import { getDbUserFromReq, requireAdmin, requireAuth } from "../../middleware/auth";
import { ok } from "../../utils/envelope";

const router = Router();

// Get reviews for a product with pagination
router.get(
  "/:productId",
  asyncHandler(async (req: Request, res: Response) => {
    const productId = String(req.params.productId || "");
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.max(1, parseInt(String(req.query.limit || "5"), 10) || 5);
    const skip = (page - 1) * limit;

    // Get approved reviews only
    const [reviews, total] = await Promise.all([
      ReviewModel.find({ productId, status: "approved" })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ReviewModel.countDocuments({ productId, status: "approved" }),
    ]);

    res.json(
      ok({
        data: reviews,
        pagination: {
          current: page,
          total: Math.ceil(total / limit),
          limit,
          totalReviews: total,
        },
      }),
    );
  }),
);

// Get review statistics for a product
router.get(
  "/:productId/stats",
  asyncHandler(async (req: Request, res: Response) => {
    const productId = String(req.params.productId || "");

    const stats = await ReviewModel.aggregate([
      {
        $match: {
          productId: new Types.ObjectId(productId),
          status: "approved",
        },
      },
      {
        $group: {
          _id: null,
          avgRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
          ratingDistribution: { $push: "$rating" },
        },
      },
    ]);

    const response = {
      averageRating: 0,
      totalReviews: 0,
      distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    };

    if (stats.length > 0) {
      response.averageRating = Math.round(stats[0].avgRating * 10) / 10;
      response.totalReviews = stats[0].totalReviews;
      stats[0].ratingDistribution.forEach((rating: number) => {
        response.distribution[rating as keyof typeof response.distribution]++;
      });
    }

    res.json(ok(response));
  }),
);

// Create review
router.post(
  "/:productId",
    requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const productId = String(req.params.productId || "");
    const rating = Number(req.body.rating);
    const title = String(req.body.title || "").trim();
    const comment = String(req.body.comment || "").trim();

    // Validate product exists
    const product = await Product.findById(productId);
    if (!product) {
      throw new AppError(404, "Product not found");
    }

    // Validate input
    if (!rating || !title || !comment) {
      throw new AppError(400, "Rating, title, and comment are required");
    }

    if (rating < 1 || rating > 5) {
      throw new AppError(400, "Rating must be between 1 and 5");    }

      const dbUser = await getDbUserFromReq(req);

    const review = await ReviewModel.create({
      productId,
      userId: dbUser._id,
      rating,
      title,
      comment,
     userName: dbUser.name || dbUser.email,
      userEmail: dbUser.email,
      status: "approved",
    });

   await updateProductRating(productId);

    res.status(201).json(ok(review));
  }),
);

// Get admin reviews (pending/rejected/all)
router.get(
  "/admin/:productId",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const productId = String(req.params.productId || "");
    const status = String(req.query.status || "all");

    const query: Record<string, string> = { productId };
    if (status !== "all") query.status = status;

    const reviews = await ReviewModel.find(query).sort({ createdAt: -1 });
    res.json(ok(reviews));
  }),
);

// Approve review
router.patch(
  "/:reviewId/approve",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const reviewId = String(req.params.reviewId || "");

    const review = await ReviewModel.findByIdAndUpdate(
      reviewId,
      { status: "approved" },
      { new: true },
    );

    if (!review) throw new AppError(404, "Review not found");

    await updateProductRating(String(review.productId));

    res.json(ok(review));
  }),
);

// Reject review
router.patch(
  "/:reviewId/reject",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const reviewId = String(req.params.reviewId || "");

    const review = await ReviewModel.findByIdAndUpdate(
      reviewId,
      { status: "approved" },
      { new: true },
    );

     if (!review) throw new AppError(404, "Review not found");

     await updateProductRating(String(review.productId));

    res.json(ok(review));
  }),
);

// Delete review
router.delete(
  "/:reviewId",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const reviewId = String(req.params.reviewId || "");

    const review = await ReviewModel.findByIdAndDelete(reviewId);
    if (!review) throw new AppError(404, "Review not found");

    await updateProductRating(String(review.productId));

    res.json(ok({ success: true }));
  }),
);

// Helper function to update product rating
async function updateProductRating(productId: string) {
  const stats = await ReviewModel.aggregate([
    {
      $match: {
        productId: new Types.ObjectId(productId),
        status: "approved",
      },
    },
    {
      $group: {
        _id: null,
        avgRating: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);

  if (stats.length > 0) {
    await Product.findByIdAndUpdate(productId, {
      averageRating: Math.round(stats[0].avgRating * 10) / 10,
      reviewCount: stats[0].count,
    });
  return;
  }
  await Product.findByIdAndUpdate(productId, {
    averageRating: 0,
    reviewCount: 0,
  });
}

export default router;
