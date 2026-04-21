import { Router, type Request, type Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { Category } from "../../models/Category.js";
import { ok } from "../../utils/envelope.js";
import { Product } from "../../models/Product.js";
import { requireFound } from "../../utils/helpers.js";
import { Brand } from "../../models/Brand.js";

export const customerProductRouter = Router();

type ProductSort = "recent" | "price-low" | "price-high";

type ProductAppliedFilterListQuery = {
  category?: string;
  brand?: string;
  color?: string;
  size?: string;
  minPrice?: string;
  maxPrice?: string;
  minRating?: string;
  minDiscount?: string;
  availability?: "all" | "in-stock" | "out-of-stock";
  productTag?: "all" | "featured" | "popular";
  sort?: ProductSort;
  page?: string;
  limit?: string;
  search?: string;
};

customerProductRouter.get(
  "/categories",

  asyncHandler(async (_req: Request, res: Response) => {
    const categories = await Category.find({}).sort({ name: 1 });

    res.json(ok(categories));
  }),
);

customerProductRouter.get(
  "/brands",

  asyncHandler(async (_req: Request, res: Response) => {
    const brands = await Brand.find({}).sort({ name: 1 });

    res.json(ok(brands));
  }),
);


customerProductRouter.get(
  "/products",

  asyncHandler(
    async (
      req: Request<{}, {}, {}, ProductAppliedFilterListQuery>,
      res: Response,
    ) => {
      const category = (req.query.category || "").trim();
      const brand = (req.query.brand || "").trim();
      const color = (req.query.color || "").trim();
      const size = (req.query.size || "").trim();
      const minPrice = Number(req.query.minPrice || 0);
      const maxPrice = Number(req.query.maxPrice || 0);
      const minRating = Number(req.query.minRating || 0);
      const minDiscount = Number(req.query.minDiscount || 0);
      const availability = String(req.query.availability || "all").trim();
      const productTag = String(req.query.productTag || "all").trim();
      const sort: ProductSort = req.query.sort || "recent";
      const search = (req.query.search || "").trim();
      const page = Math.max(Number(req.query.page || 1), 1);
      const limit = Math.max(Number(req.query.limit || 12), 1);

      const query: Record<string, unknown> = {
        status: "active",
      };

      if (category) {
        query.category = category;
      }
      if (brand) {
        query.brand = brand;
      }
      if (color) {
        query.colors = color;
      }
      if (size) {
        query.sizes = size;
      }
      if (Number.isFinite(minPrice) && minPrice > 0) {
        query.price = { ...(query.price as object), $gte: minPrice };
      }
      if (Number.isFinite(maxPrice) && maxPrice > 0) {
        query.price = { ...(query.price as object), $lte: maxPrice };
      }
      if (Number.isFinite(minRating) && minRating > 0) {
        query.averageRating = { $gte: minRating };
      }
      if (Number.isFinite(minDiscount) && minDiscount > 0) {
        query.salePercentage = { $gte: minDiscount };
      }
      if (availability === "in-stock") {
        query.stock = { $gt: 0 };
      }
      if (availability === "out-of-stock") {
        query.stock = 0;
      }
      if (productTag === "featured") {
        query.isFeatured = true;
      }
      if (productTag === "popular") {
        query.isPopular = true;
      }
      if (search) {
        query.title = { $regex: search, $options: "i" };
      }

      let sortOption: Record<string, 1 | -1> = { createdAt: -1 };

      if (sort === "price-low") {
        sortOption = { price: 1 };
      }

      if (sort === "price-high") {
        sortOption = { price: -1 };
      }

      const [products, total] = await Promise.all([
        Product.find(query)
          .populate("category", "name")
          .sort(sortOption)
          .skip((page - 1) * limit)
          .limit(limit),
        Product.countDocuments(query),
      ]);

      res.json(
        ok({
          items: products,
          pagination: {
            page,
            limit,
            total,
            hasNext: page * limit < total,
          },
        }),
      );
    },
  ),
);

customerProductRouter.get(
  "/products/:id",

  asyncHandler(async (req: Request, res: Response) => {
    const productId = req.params.id;

    const product = await Product.findOne({
      _id: productId,
      status: "active",
    }).populate("category", "name");

    const foundProduct = requireFound(product, "Product not found", 404);

    const relatedProducts = await Product.find({
      _id: { $ne: foundProduct._id },
      category: foundProduct.category,
      status: "active",
    })
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .limit(4);

    res.json(
      ok({
        product: foundProduct,
        relatedProducts,
      }),
    );
  }),
);
