import { Router, type Request, type Response } from "express";
import multer from "multer";
import { getDbUserFromReq, requireAdmin } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { Category } from "../../models/Category.js";
import { ok } from "../../utils/envelope.js";
import { requireFound, requireNumber, requireText } from "../../utils/helpers.js";
import { Product } from "../../models/Product.js";
import { AppError } from "../../utils/AppError.js";
import { uploadManyBuffersToCloudinary } from "../../utils/cloudinary.js";
import { Brand } from "../../models/Brand.js";
import { SpecificationModel } from "../../models/Specification.js";
import { ReviewModel } from "../../models/Review.js";

type UploadedImage = {
  url: string;
  publicId: string;
  isCover: boolean;
};

type ReviewInput = {
  rating?: number;
  title?: string;
  comment?: string;
  userName?: string;
  userEmail?: string;
};

function normalizeArrayField(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }

  return [];
}

function parseSpecifications(rawSpecifications: string) {
  const allowedSpecificationKeys = new Set([
    "material",
    "weight",
    "dimension",
    "warranty",
    "color_options",
    "brand_origin",
    "care_instructions",
    "custom",
  ]);
  try {
    const parsed = JSON.parse(rawSpecifications) as Array<{
      key?: string;
      value?: string;
    }>;

    return parsed
      .map((item) => ({
       key: String(item.key || "").trim().toLowerCase().replace(/\s+/g, "_"),
        displayKey: String(item.key || "").trim(),
        value: String(item.value || "").trim(),
      }))
      .filter((item) => item.displayKey && item.value)
      .map((item) => ({
        key: allowedSpecificationKeys.has(item.key) ? item.key : "custom",
        displayKey: item.displayKey,
        value: item.value,
      }));
  } catch {
    return [];
  }
}

function parseReviews(rawReviews: string) {
  try {
    const parsed = JSON.parse(rawReviews) as ReviewInput[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((review) => ({
        rating: Number(review.rating),
        title: String(review.title || "").trim(),
        comment: String(review.comment || "").trim(),
        userName: String(review.userName || "").trim(),
        userEmail: String(review.userEmail || "").trim(),
      }))
      .filter(
        (review) =>
          Number.isFinite(review.rating) &&
          review.rating >= 1 &&
          review.rating <= 5 &&
          review.title &&
          review.comment &&
          review.userName &&
          review.userEmail,
      );
  } catch {
    return [];
  }
}


export const adminProductRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fieldSize: 5 * 1024 * 1024,
    files: 10,
  },
});

adminProductRouter.use(requireAdmin);

// categories

adminProductRouter.get(
  "/categories",
  asyncHandler(async (_req: Request, res: Response) => {
    const categories = await Category.find({}).sort({
      name: 1,
    });

    res.json(ok(categories));
  }),
);

adminProductRouter.post(
  "/categories",
  asyncHandler(async (req: Request, res: Response) => {
    const name = String(req.body.name || "").trim();

    requireText(name, "Category name is needed");

    const existing = await Category.findOne({ name });

    if (existing) {
      throw new AppError(400, "Category already exists");
    }

    const category = await Category.create({ name });

    res.status(201).json(ok(category));
  }),
);

adminProductRouter.put(
  "/categories/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const name = String(req.body.name || "").trim();
    const extractCategoryId = req.params.id as string;

    requireText(name, "Category name is needed");

    const existingCategory = await Category.findById(extractCategoryId);
    const category = requireFound(existingCategory, "Category not found");

    category.name = name;

    await category.save();
    res.json(ok(category));
  }),
);

adminProductRouter.delete(
  "/categories/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const categoryId = req.params.id as string;
    const linkedProducts = await Product.countDocuments({ category: categoryId });

    if (linkedProducts > 0) {
      throw new AppError(400, "Category is used by existing products");
    }

    const deleted = await Category.findByIdAndDelete(categoryId);
    requireFound(deleted, "Category not found", 404);

    res.json(ok({ success: true }));
  }),
);

// brands
adminProductRouter.get(
  "/brands",
  asyncHandler(async (_req: Request, res: Response) => {
    const brands = await Brand.find().sort({ name: 1 });
    res.json(ok(brands));
  }),
);

adminProductRouter.post(
  "/brands",
  asyncHandler(async (req: Request, res: Response) => {
    const name = String(req.body.name || "").trim();
    requireText(name, "Brand name is needed");

    const existing = await Brand.findOne({ name });

    if (existing) {
      throw new AppError(400, "Brand already exists");
    }

    const brand = await Brand.create({ name });

    res.status(201).json(ok(brand));
  }),
);

adminProductRouter.put(
  "/brands/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const brandId = req.params.id as string;
    const name = String(req.body.name || "").trim();
    requireText(name, "Brand name is needed");

    const existingBrand = await Brand.findById(brandId);
    const brand = requireFound(existingBrand, "Brand not found");

    brand.name = name;

    await brand.save();

    res.json(ok(brand));
  }),
);

adminProductRouter.delete(
  "/brands/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const brandId = req.params.id as string;
    const brandDoc = await Brand.findById(brandId);
    const brand = requireFound(brandDoc, "Brand not found", 404);

    const linkedProducts = await Product.countDocuments({ brand: brand.name });

    if (linkedProducts > 0) {
      throw new AppError(400, "Brand is used by existing products");
    }

    await Brand.findByIdAndDelete(brand._id);

    res.json(ok({ success: true }));
  }),
);


// products
adminProductRouter.get(
  "/products",
  asyncHandler(async (req: Request, res: Response) => {
    const search = String(req.query.search || "").trim();

    const query: Record<string, unknown> = {};

    if (search) {
      query.title = { $regex: search, $options: "i" };
    }

    const products = await Product.find(query)
      .populate("category", "name")
      .sort({ createdAt: -1 });

    res.json(ok(products));
  }),
);

adminProductRouter.get(
  "/products/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const productId = req.params.id as string;

    const product = await Product.findById(productId).populate("category", "name");

    requireText(product, "Product not found", 404);

   const [specifications, reviews] = await Promise.all([
      SpecificationModel.find({ productId: productId }).sort({ createdAt: -1 }),
      ReviewModel.find({ productId: productId }).sort({ createdAt: -1 }),
    ]);

    res.json(
      ok({
        ...product.toObject(),
        specifications,
        reviews,
      }),
    );
  }),
);

adminProductRouter.post(
  "/products",
  upload.array("images", 10),
  asyncHandler(async (req: Request, res: Response) => {
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    const category = String(req.body.category || "").trim();
    const brand = String(req.body.brand || "").trim();
    const price = Number(req.body.price);
    const salePercentage = Number(req.body.salePercentage || 0);
    const stock = Number(req.body.stock);
    const status = String(req.body.status || "active").trim();
    const colors = normalizeArrayField(req.body.colors);
    const sizes = normalizeArrayField(req.body.sizes);
    const isFeatured = String(req.body.isFeatured || "false") === "true";
    const isPopular = String(req.body.isPopular || "false") === "true";
    const rawSpecifications = String(req.body.specifications || "[]");
    const rawReviews = String(req.body.reviews || "[]");

    requireText(title, "Title is required");
    requireText(description, "Description is required");
    requireText(category, "Category is required");
    requireText(brand, "Brand is required");

    requireNumber(price, "Price is required");
    requireNumber(salePercentage, "Sale Percentage is required");
    requireNumber(stock, "Stock is required");

    const existingCategory = await Category.findById(category);

    requireText(existingCategory, "Category not found", 404);

    const files = (req.files as Express.Multer.File[]) || [];

    if (!files.length) {
      throw new AppError(400, "Atleast one image is needed");
    }

    const uploadedImages = await uploadManyBuffersToCloudinary(
      files.map((file) => file.buffer),
    );

    const images = uploadedImages.map((img, index) => ({
      url: img.url,
      publicId: img.publicId,
      isCover: index === 0,
    }));

    const user = await getDbUserFromReq(req);

    const product = await Product.create({
      title,
      description,
      category,
      brand,
      images,
      colors,
      sizes,
      price,
      salePercentage,
      stock,
      status,
      isFeatured,
      isPopular,
      createdBy: user._id,
    });

    const specifications = parseSpecifications(rawSpecifications);
    const reviews = parseReviews(rawReviews);

    if (specifications.length) {
      await SpecificationModel.insertMany(
        specifications.map((item) => ({
          productId: product._id,
          key: item.key,
          value: item.value,
          displayKey: item.displayKey,
        })),
      );
    }

    if (reviews.length) {
      await ReviewModel.insertMany(
        reviews.map((review) => ({
          productId: product._id,
          userId: user._id,
          rating: review.rating,
          title: review.title,
          comment: review.comment,
          userName: review.userName,
          userEmail: review.userEmail,
          status: "approved",
        })),
      );
    }

    const approvedReviews = reviews.filter((review) => review.rating);
    if (approvedReviews.length) {
      const total = approvedReviews.reduce((sum, review) => sum + review.rating, 0);
      product.averageRating = Math.round((total / approvedReviews.length) * 10) / 10;
      product.reviewCount = approvedReviews.length;
      await product.save();
    }


    const createdProduct = await Product.findById(product._id).populate(
      "category",
      "name",
    );

    res.status(201).json(ok(createdProduct));
  }),
);

adminProductRouter.put(
  "/products/:id",
  upload.array("images", 10),
  asyncHandler(async (req: Request, res: Response) => {
    const productId = req.params.id as string;
    const title = String(req.body.title || "").trim();
    const description = String(req.body.description || "").trim();
    const category = String(req.body.category || "").trim();
    const brand = String(req.body.brand || "").trim();
    const price = Number(req.body.price);
    const salePercentage = Number(req.body.salePercentage || 0);
    const stock = Number(req.body.stock);
    const status = String(req.body.status || "active").trim() as
      | "active"
      | "inactive";
    const colors = normalizeArrayField(req.body.colors);
    const sizes = normalizeArrayField(req.body.sizes);
    const coverImagePublicId = String(req.body.coverImagePublicId || "").trim();
    const isFeatured = String(req.body.isFeatured || "false") === "true";
    const isPopular = String(req.body.isPopular || "false") === "true";
    const rawSpecifications = String(req.body.specifications || "[]");
    const rawReviews = String(req.body.reviews || "[]");

    requireText(title, "Title is required");
    requireText(description, "Description is required");
    requireText(category, "Category is required");
    requireText(brand, "Brand is required");

    requireNumber(price, "Price is required");
    requireNumber(salePercentage, "Sale Percentage is required");
    requireNumber(stock, "Stock is required");

    const existingCategoryDoc = await Category.findById(category);
    const existingCategory = requireFound(
      existingCategoryDoc,
      "Category not found",
    );

    const productDoc = await Product.findById(productId);
    const product = requireFound(productDoc, "Product not found");

    const files = (req.files as Express.Multer.File[]) || [];

    const uploadNewImages = await uploadManyBuffersToCloudinary(
      files.map((file) => file.buffer),
    );

    const newlyAddedImages = uploadNewImages.map((image) => ({
      url: image.url,
      publicId: image.publicId,
      isCover: false,
    }));

    const existingImages: UploadedImage[] = (() => {
      const rawValue = req.body.existingImages;

      if (!rawValue) {
        return product.images.map((img: UploadedImage) => ({
          url: img.url,
          publicId: img.publicId,
          isCover: img.isCover,
        }));
      }

      try {
        const parsed = JSON.parse(rawValue as string) as UploadedImage[];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })();

    const mergedImages: UploadedImage[] = [
      ...existingImages,
      ...newlyAddedImages,
    ];

    if (!mergedImages.length) {
      throw new AppError(400, "Atleast one img is needed");
    }

    const finalImages: UploadedImage[] = mergedImages.map(
      (image: UploadedImage, index) => ({
        url: image.url,
        publicId: image.publicId,
        isCover: coverImagePublicId
          ? image.publicId === coverImagePublicId
          : index === 0,
      }),
    );

    product.title = title;
    product.description = description;
    product.category = existingCategory._id;
    product.brand = brand;
    product.colors = colors;
    product.sizes = sizes;
    product.price = price;
    product.salePercentage = salePercentage;
    product.stock = stock;
    product.isFeatured = isFeatured;
    product.isPopular = isPopular;
    product.status = status;
    product.set("images", finalImages);

    const specifications = parseSpecifications(rawSpecifications);
    const reviews = parseReviews(rawReviews);

    if (Array.isArray(specifications)) {
      await SpecificationModel.deleteMany({ productId: product._id });
      if (specifications.length) {
        await SpecificationModel.insertMany(
          specifications.map((item) => ({
            productId: product._id,
            key: item.key,
            value: item.value,
            displayKey: item.displayKey,
          })),
        );
      }
    }

    await ReviewModel.deleteMany({ productId: product._id });
    if (reviews.length) {
      await ReviewModel.insertMany(
        reviews.map((review) => ({
          productId: product._id,
          userId: product.createdBy,
          rating: review.rating,
          title: review.title,
          comment: review.comment,
          userName: review.userName,
          userEmail: review.userEmail,
          status: "approved",
        })),
      );
    }

    if (reviews.length) {
      const total = reviews.reduce((sum, review) => sum + review.rating, 0);
      product.averageRating = Math.round((total / reviews.length) * 10) / 10;
      product.reviewCount = reviews.length;
    } else {
      product.averageRating = 0;
      product.reviewCount = 0;
    }


    await product.save();

    const updatedProduct = await Product.findById(product._id).populate(
      "category",
      "name",
    );

    res.json(ok(updatedProduct));
  }),
);

adminProductRouter.delete(
  "/products/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const productId = req.params.id as string;
    const deletedProduct = await Product.findByIdAndDelete(productId);

    requireFound(deletedProduct, "Product not found", 404);

    await Promise.all([
      SpecificationModel.deleteMany({ productId }),
      ReviewModel.deleteMany({ productId }),
    ]);

    res.json(ok({ success: true }));
  }),
);