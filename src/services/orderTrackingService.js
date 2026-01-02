import Order from "../models/order.js";
import { emitOrderStatusUpdate } from "./socketService.js";

// Configuration for automatic status progression (in milliseconds)
const STATUS_PROGRESSION_DELAYS = {
  "Pending": 2 * 60 * 1000,      // 2 minutes: Pending -> Processing
  "Processing": 5 * 60 * 1000,   // 5 minutes: Processing -> Shipped
  "Shipped": 10 * 60 * 1000,     // 10 minutes: Shipped -> Delivered (for demo)
  // In production, use actual delivery estimates (days, not minutes)
};

/**
 * Automatically progress order status based on time
 */
export const autoProgressOrderStatus = async () => {
  try {
    const now = new Date();
    const orders = await Order.find({
      status: { $in: ["Pending", "Processing", "Shipped"] },
      paymentStatus: "completed"
    });

    for (const order of orders) {
      const statusChangeTime = order.updatedAt || order.createdAt;
      const timeSinceStatusChange = now - new Date(statusChangeTime);
      const delay = STATUS_PROGRESSION_DELAYS[order.status];

      if (delay && timeSinceStatusChange >= delay) {
        await progressOrderStatus(order);
      }
    }
  } catch (error) {
    console.error("Error in auto progress order status:", error);
  }
};

/**
 * Progress order to next status
 */
const progressOrderStatus = async (order) => {
  const statusFlow = {
    "Pending": "Processing",
    "Processing": "Shipped",
    "Shipped": "Delivered"
  };

  const currentStatus = order.status;
  const nextStatus = statusFlow[currentStatus];
  
  if (!nextStatus || currentStatus === "Delivered" || currentStatus === "Cancelled") {
    return;
  }

  // Set override message for pre-save middleware
  const statusMessages = {
    "Processing": "Order confirmed and being prepared automatically",
    "Shipped": "Order has been shipped automatically",
    "Delivered": "Order has been delivered automatically"
  };

  order.$locals = order.$locals || {};
  order.$locals.statusMessageOverride = statusMessages[nextStatus] || `Order status changed to ${nextStatus} automatically`;

  // Update order status (pre-save middleware will add timeline entry)
  order.status = nextStatus;

  // Update estimated delivery when shipped
  if (nextStatus === "Shipped" && !order.tracking.estimatedDelivery) {
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 7); // 7 days from now
    order.tracking.estimatedDelivery = deliveryDate;
  }

  await order.save();

  // Emit real-time update
  emitOrderStatusUpdate(order._id.toString(), {
    status: order.status,
    tracking: order.tracking,
    paymentStatus: order.paymentStatus,
    message: statusMessages[nextStatus] || `Order status changed to ${nextStatus}`
  });

  console.log(`Order ${order._id} automatically progressed from ${currentStatus} to ${nextStatus}`);
};

/**
 * Start automatic order status progression service
 */
export const startOrderTrackingService = () => {
  // Check every minute for orders that need status progression
  setInterval(autoProgressOrderStatus, 60 * 1000);
  
  console.log("Order tracking service started - checking for automatic status progression every minute");
};

