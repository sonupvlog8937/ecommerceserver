import { getDbUserFromReq, requireAdmin } from "../../middleware/auth.js";
import multer from "multer";
import { Banner, BannerDocument } from "../../models/Banner.js";
import { Router, type Request, type Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/envelope.js";
import { AppError } from "../../utils/AppError.js";
import { uploadManyBuffersToCloudinary } from "../../utils/cloudinary.js";

type AdminBannerItem = {
  _id: string;
  imageUrl: string;
  imagePublicId: string;
  createdAt: string;
};

function mapBanner(item: BannerDocument): AdminBannerItem {
  return {
    _id: String(item._id),
    imageUrl: item.imageUrl,
    imagePublicId: item.imagePublicId,
    createdAt: item.createdAt.toISOString(),
  };
}

const BANNER_FOLDER = "ecommerce-monster-video/banners";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fieldSize: 5 * 1024 * 1024,
    files: 10,
  },
});

export const adminSettingsRouter = Router();

adminSettingsRouter.use(requireAdmin);

adminSettingsRouter.get(
  "/settings/banners",
  asyncHandler(async (req: Request, res: Response) => {
    const items = await Banner.find().sort({ createdAt: -1 });

    res.json(
      ok({
        items: items.map(mapBanner),
      }),
    );
  }),
);

adminSettingsRouter.post(
  "/settings/banners",
  upload.array("images", 10),
  asyncHandler(async (req: Request, res: Response) => {
    const dbUser = await getDbUserFromReq(req);

    const files = (req.files || []) as Express.Multer.File[];

    if (!files.length) {
      throw new AppError(400, "At least one image is required");
    }

    const uploadedImages = await uploadManyBuffersToCloudinary(
      files.map((file) => file.buffer),
      BANNER_FOLDER,
    );

    const createFinalBanners = await Banner.insertMany(
      uploadedImages.map((item) => ({
        imageUrl: item.url,
        imagePublicId: item.publicId,
        createdBy: dbUser._id,
      })),
    );

    res.json(
      ok({
        items: createFinalBanners.map(mapBanner),
      }),
    );
  }),
);

adminSettingsRouter.delete(
  "/settings/banners/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const bannerId = req.params.id as string;

    const deletedBanner = await Banner.findByIdAndDelete(bannerId);

    if (!deletedBanner) {
      throw new AppError(404, "Banner not found");
    }

    const items = await Banner.find().sort({ createdAt: -1 });

    res.json(
      ok({
        items: items.map(mapBanner),
      }),
    );
  }),
);