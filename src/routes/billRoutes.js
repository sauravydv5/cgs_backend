import express from "express";
import {
  addBill,
  getBills,
  getBillById,
  getBillsByCustomer,
  getBillsByDateRange,
  updateBill,
  deleteBill,
  updateBillPaymentStatus,
  getDraftBills,
} from "../controllers/billController.js";
import protect, { adminOnly, checkPermission } from "../middleware/authMiddleware.js";
import { generateBillByCustomer } from "../controllers/billGenerator.js";



const router = express.Router();

// Static routes first to avoid conflicts with dynamic routes
router.get("/all", protect, checkPermission("bill"), getBills);
router.get("/date-range", protect, checkPermission("bill"), getBillsByDateRange);
router.get("/drafts", protect, checkPermission("bill"), getDraftBills);

// Then dynamic/other routes
router.post("/add", protect, checkPermission("bill"), addBill);
router.get("/details/:id", protect, checkPermission("bill"), getBillById);
router.get("/customer/:customerId", protect, checkPermission("bill"), getBillsByCustomer);
router.put("/update/:id", protect, checkPermission("bill"), updateBill);
router.put("/status/:id", protect, checkPermission("bill"), updateBillPaymentStatus);
router.delete("/delete/:id", protect, checkPermission("bill"), deleteBill);
router.get(
  "/generate/customer/:customerId",
  protect,
  checkPermission("bill"),
  generateBillByCustomer
);
export default router;
