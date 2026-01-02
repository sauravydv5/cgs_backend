import express from "express";
import { 
  createOrder, 
  getUserOrders, 
  getOrderById, 
  getAllOrdersForAdmin,
  verifyPayment,
  razorpayWebhook,
  getOrderHistory,
  getOrderTracking,
  cancelOrder,
  updateOrderStatus
} from "../controllers/orderController.js";
import protect, { adminOnly, checkPermission } from "../middleware/authMiddleware.js";

const router = express.Router();

// Webhook route (no authentication required - called by Razorpay)
// Note: This route is registered in main app with express.raw() middleware
// The body will be a Buffer, we'll parse it in the controller
router.post("/webhook/razorpay", razorpayWebhook);

// Create order
router.post("/", protect, createOrder);

// Verify payment
router.post("/verify-payment", protect, verifyPayment);

// Admin routes must come first (static paths)
router.get("/admin", protect, checkPermission("order"), getAllOrdersForAdmin);
router.put("/admin/:id/status", protect, checkPermission("order"), updateOrderStatus);

// Order history and tracking routes (must come before /:id)
router.get("/history", protect, getOrderHistory);
router.get("/tracking/:id", protect, getOrderTracking);

// User routes
router.get("/", protect, getUserOrders);
router.post("/:id/cancel", protect, cancelOrder);
router.get("/:id", protect, getOrderById); // dynamic route comes last

export default router;
