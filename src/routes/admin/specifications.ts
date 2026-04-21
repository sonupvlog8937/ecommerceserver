import { Router, Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { AppError } from "../../utils/AppError.js";
import { SpecificationModel } from "../../models/Specification.js";
import { Product } from "../../models/Product.js";
import { requireAdmin } from "../../middleware/auth.js";
import { ok } from "../../utils/envelope.js";

const router = Router();

// Get specifications for a product
router.get(
  "/:productId",
  asyncHandler(async (req: Request, res: Response) => {
    const productId = String(req.params.productId || "");

    const specifications = await SpecificationModel.find({ productId }).sort(
      { createdAt: 1 }
    );

    res.status(200).json(ok(specifications));
  })
);

// Create specification (Admin only)
router.post(
  "/:productId",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const productId = String(req.params.productId || "");
    const { key, value } = req.body;

    // Verify product exists
    const product = await Product.findById(productId);
    if (!product) {
      throw new AppError(404, "Product not found");
    }

    // Check if specification with same key exists
    let specification = await SpecificationModel.findOne({
      productId,
      key,
    });

    if (specification) {
      // Update existing
      specification.value = value;
      await specification.save();
    } else {
      // Create new
      specification = await SpecificationModel.create({
        productId,
        key,
        value,
      });
    }

    res.status(201).json(ok(specification));
  })
);

// Update specification
router.patch(
  "/:specificationId",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const specificationId = String(req.params.specificationId || "");
    const { key, value } = req.body;

    const specification = await SpecificationModel.findByIdAndUpdate(
      specificationId,
      { key, value },
      { new: true }
    );

    if (!specification) {
      throw new AppError(404, "Specification not found");
    }

    res.status(200).json(ok(specification));
  })
);

// Delete specification
router.delete(
  "/:specificationId",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const specificationId = String(req.params.specificationId || "");

    const specification = await SpecificationModel.findByIdAndDelete(
      specificationId
    );

    if (!specification) {
      throw new AppError(404, "Specification not found");
    }

    res.status(200).json(ok({ success: true }));
  })
);

// Delete all specifications for a product
router.delete(
  "/product/:productId",
  requireAdmin,
  asyncHandler(async (req: Request, res: Response) => {
    const productId = String(req.params.productId || "");

    await SpecificationModel.deleteMany({ productId });

    res.status(200).json(ok({ success: true }));
  })
);

export default router;
