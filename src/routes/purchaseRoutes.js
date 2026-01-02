import express from "express";
import {
  addPurchase,
  getAllPurchases,
  updatePurchase,
  deletePurchase,
  getPurchaseById,
  getPurchaseVouchers,
  getPurchasesByDateRange,
} from "../controllers/purchaseController.js";
import protect, { checkPermission } from "../middleware/authMiddleware.js";

const router = express.Router();

// Purchase APIs
router.post("/add", protect, checkPermission("purchase"), addPurchase);
router.get("/all", protect, checkPermission("purchase"), getAllPurchases);
router.get("/date-range", protect, checkPermission("purchase"), getPurchasesByDateRange);
router.put("/update/:id", protect, checkPermission("purchase"), updatePurchase);
router.delete("/delete/:id", protect, checkPermission("purchase"), deletePurchase);

// Purchase Voucher Routes
router.get("/vouchers", protect, checkPermission("purchase"), getPurchaseVouchers); // Fetch data for new voucher
router.post("/voucher", protect, checkPermission("purchase"), addPurchase);       // Save new voucher
router.get("/:id", protect, checkPermission("purchase"), getPurchaseById);        // ✅ Get Single Purchase (Must be last)

export default router;
