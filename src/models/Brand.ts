import mongoose, { HydratedDocument } from "mongoose";

export type Brand = {
  name: string;
  createdAt: Date;
  updatedAt: Date;
};

export type BrandDocument = HydratedDocument<Brand>;

const BrandSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
  },
  { timestamps: true },
);

export const Brand =
  mongoose.models.Brand || mongoose.model<Brand>("Brand", BrandSchema);
