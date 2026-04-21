import { Router, type Request, type Response } from "express";
import { Types } from "mongoose";
import { asyncHandler } from "../../utils/asyncHandler";
import { Banner } from "../../models/Banner";
import { Category } from "../../models/Category";
import { Product } from "../../models/Product";
import { Promo } from "../../models/Promo";
import { ok } from "../../utils/envelope";
import { Brand } from "../../models/Brand";

type BannerRow = {
  _id: Types.ObjectId;
  imageUrl: string;
  createdAt: Date;
};

type CategoryRow = {
  _id: Types.ObjectId;
  name: string;
};

type ProductRow = {
  _id: Types.ObjectId;
  title: string;
  brand: string;
  price: number;
  salePercentage: number;
  images: Array<{
    url: string;
    isCover?: boolean;
  }>;
  createdAt: Date;
};

type PromoRow = {
  _id: Types.ObjectId;
  code: string;
  percentage: number;
  count: number;
  minimumOrderValue: number;
  endsAt: Date;
};

export const customerHomeRouter = Router();

function mapProduct(item: ProductRow) {
  const image =
    item.images.find((entry) => entry.isCover)?.url || item.images[0]?.url || "";

  const finalPrice = item.salePercentage
    ? Math.round(item.price - (item.price * item.salePercentage) / 100)
    : item.price;

  return {
    _id: String(item._id),
    title: item.title,
    brand: item.brand,
    image,
    price: item.price,
    finalPrice,
    salePercentage: item.salePercentage,
    createdAt: item.createdAt.toISOString(),
  };
}


customerHomeRouter.get(
  "/home",
  asyncHandler(async (_req: Request, res: Response) => {
    const now = new Date();

    const [banners, categories, brands, recentProducts, featuredProducts, popularProducts, promos] =
      await Promise.all([
        Banner.find().sort({ createdAt: -1 }).limit(6).lean<BannerRow[]>(),
        Category.find().sort({ name: 1 }).lean<CategoryRow[]>(),
        Brand.find().sort({ name: 1 }),
        Product.find({ status: "active" })
          .select("title brand price salePercentage images createdAt")
          .sort({ createdAt: -1 })
          .limit(8)
          .lean<ProductRow[]>(),
        Product.find({ status: "active", isFeatured: true })
          .select("title brand price salePercentage images createdAt")
          .sort({ createdAt: -1 })
          .limit(8)
          .lean<ProductRow[]>(),
        Product.find({ status: "active", isPopular: true })
          .select("title brand price salePercentage images createdAt")
          .sort({ createdAt: -1 })
          .limit(8)
          .lean<ProductRow[]>(),
        Promo.find({
          startsAt: { $lte: now },
          endsAt: { $gte: now },
          count: { $gt: 0 },
        })
          .sort({ createAt: -1 })
          .limit(4)
          .lean<PromoRow[]>(),
      ]);

    res.json(
      ok({
        banners: banners.map((bannerItem) => ({
          _id: String(bannerItem._id),
          imageUrl: bannerItem.imageUrl,
          createdAt: bannerItem.createdAt.toISOString(),
        })),
        categories: categories.map((categoryItem) => ({
          _id: String(categoryItem._id),
          name: categoryItem.name,
        })),
        brands: brands.map((brandItem) => ({
          _id: String(brandItem._id),
          name: brandItem.name,
        })),
        recentProducts: recentProducts.map(mapProduct),
        featuredProducts: featuredProducts.map(mapProduct),
        popularProducts: popularProducts.map(mapProduct),
        coupons: promos.map((promoItem) => ({
          _id: String(promoItem._id),
          code: promoItem.code,
          percentage: promoItem.percentage,
          count: promoItem.count,
          minimumOrderValue: promoItem.minimumOrderValue,
          endsAt: promoItem.endsAt.toISOString(),
        })),
      }),
    );
  }),
);
