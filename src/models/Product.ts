import mongoose, { HydratedDocument, Schema, Types } from "mongoose";

export type ProductImage = {
  url: string;
  publicId: string;
  isCover: boolean;
};

export type ProductSize = "S" | "M" | "L" | "XL";
export type ProductStatus = "active" | "inactive";

export type Product = {
  title: string;
  description: string;
  category: Types.ObjectId;
  brand: string;
  stock: number;
  images: ProductImage[];
  colors: string[];
  sizes: ProductSize[];
  price: number;
  salePercentage: number;
  status: ProductStatus;
  isFeatured: boolean;
  isPopular: boolean;
  createdBy: Types.ObjectId;
  averageRating?: number;
  reviewCount?: number;
  createdAt: Date;
  updatedAt: Date;
};

export type ProductDocument = HydratedDocument<Product>;

const productImageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      trim: true,
    },
    publicId: {
      type: String,
      required: true,
      trim: true,
    },
    isCover: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: false,
  },
);

const ProductSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    brand: {
      type: String,
      required: true,
      trim: true,
    },
    stock: {
      type: Number,
      required: true,
      min: 0,
    },
    images: {
      type: [productImageSchema],
      default: [],
    },
    colors: {
      type: [String],
      default: [],
    },
    sizes: {
      type: [String],
      default: [],
      enum: ["S", "M", "L", "XL"],
    },
    price: {
      type: Number,
      required: true,
    },
    salePercentage: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isPopular: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviewCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

export const Product =
  mongoose.models.Product || mongoose.model<Product>("Product", ProductSchema);
