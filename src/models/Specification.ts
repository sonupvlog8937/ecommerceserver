import { Schema, model, Types } from "mongoose";

export type SpecificationKey = "material" | "weight" | "dimension" | "warranty" | "color_options" | "custom";

export interface Specification {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  key: SpecificationKey | string;
  value: string;
  displayKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const specificationSchema = new Schema<Specification>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    key: {
      type: String,
      required: true,
      enum: [
        "material",
        "weight",
        "dimension",
        "warranty",
        "color_options",
        "brand_origin",
        "care_instructions",
        "custom",
      ],
    },
    value: {
      type: String,
      required: true,
    },
    displayKey: {
      type: String,
      default: function (this: Specification) {
        return this.key
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
      },
    },
  },
  { timestamps: true }
);

// Compound index for faster queries
specificationSchema.index({ productId: 1, key: 1 }, { unique: false });

export const SpecificationModel = model<Specification>(
  "Specification",
  specificationSchema
);
