import { Router, type Request, type Response } from "express";
import { Types } from "mongoose";
import { Order, OrderStatus, PaymentMethod, PaymentStatus } from "../../models/Order";
import { requireAdmin } from "../../middleware/auth";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/envelope";
import { requireFound, requireText } from "../../utils/helpers";
import { AppError } from "../../utils/AppError";
import { Product } from "../../models/Product";

const ALLOWED_ORDER_STATUSES = [
  "placed",
  "shipped",
  "delivered",
  "returned",
] as const;

type AdminOrderStatus = (typeof ALLOWED_ORDER_STATUSES)[number];

type AdminOrderRow = {
  _id: Types.ObjectId;
  customerName: string;
  customerEmail: string;
  deliveryName: string;
  deliveryAddress: string;
  totalItems: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  orderStatus: OrderStatus;
  trackingId: string;
  items: Array<{
    quantity: number;
    product:
      | {
          _id: Types.ObjectId;
          title: string;
          images?: Array<{ url: string; isCover: boolean }>;
        }
      | null;
  }>;
  paidAt?: Date | null;
  deliveredAt?: Date | null;
  returnedAt?: Date | null;
  createdAt: Date;
};

export const adminOrderRouter = Router();

adminOrderRouter.use(requireAdmin);

adminOrderRouter.get(
  "/orders",
  asyncHandler(async (req: Request, res: Response) => {
    const orders = await Order.find()
      .select(
         "customerName customerEmail deliveryName deliveryAddress items totalItems totalAmount paymentStatus paymentMethod orderStatus trackingId paidAt deliveredAt returnedAt createdAt",
      )
      .populate({
        path: "items.product",
        select: "title images",
        model: Product,
      })
      .sort({ createdAt: -1 })
      .lean<AdminOrderRow[]>();

    res.json(
      ok({
        items: orders.map((orderItem) => ({
          _id: String(orderItem._id),
          code: String(orderItem._id).slice(-8).toUpperCase(),
          customerName: orderItem.customerName,
          customerEmail: orderItem.customerEmail,
          deliveryName: orderItem.deliveryName,
          deliveryAddress: orderItem.deliveryAddress,
          totalItems: orderItem.totalItems,
          totalAmount: orderItem.totalAmount,
          paymentStatus: orderItem.paymentStatus,
          paymentMethod: orderItem.paymentMethod,
          orderStatus: orderItem.orderStatus,
          trackingId: orderItem.trackingId,
          items: orderItem.items.map((lineItem) => ({
            quantity: lineItem.quantity,
            product: lineItem.product
              ? {
                  _id: String(lineItem.product._id),
                  title: lineItem.product.title,
                  image:
                    lineItem.product.images?.find((image) => image.isCover)
                      ?.url ||
                    lineItem.product.images?.[0]?.url ||
                    "",
                }
              : null,
          })),
          paidAt: orderItem.paidAt,
          deliveredAt: orderItem.deliveredAt,
          returnedAt: orderItem.returnedAt,
          createdAt: orderItem.createdAt,
        })),
      }),
    );
  }),
);

adminOrderRouter.patch(
  "/orders/:orderId/status",
  asyncHandler(async (req: Request, res: Response) => {
    const orderId = String(req.params.orderId || "").trim();
    const orderStatus = String(
      req.body.orderStatus || "",
    ).trim() as AdminOrderStatus;

    requireText(orderId, "Order Id is required");
    requireText(orderStatus, "orderStatus is required");

    if (!ALLOWED_ORDER_STATUSES.includes(orderStatus)) {
      throw new AppError(400, "Invalid order status");
    }

    const order = await Order.findById(orderId);
    const foundOrder = requireFound(order, "Order not found", 404);

    // admin can return order -> increase the product quantity
    // update returnedAt property
    // add the points to that user points

    if (orderStatus === "returned" && foundOrder.orderStatus !== "returned") {
      for (const item of foundOrder.items) {
        await Product.updateOne(
          { _id: item.product },
          {
            $inc: { stock: item.quantity },
          },
        );
      }
    }

    if (orderStatus === "delivered" && !foundOrder.deliveredAt) {
      foundOrder.deliveredAt = new Date();
    }

    if (orderStatus === "returned" && !foundOrder.returnedAt) {
      foundOrder.returnedAt = new Date();
    }

    foundOrder.orderStatus = orderStatus;
    await foundOrder.save();

    res.json(
      ok({
        _id: String(foundOrder._id),
        orderStatus: foundOrder.orderStatus,
        deliveredAt: foundOrder.deliveredAt,
        returnedAt: foundOrder.returnedAt,
      }),
    );
  }),
);
