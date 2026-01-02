import express from "express";
import {
  addPurchaseReturn,
  getAllPurchaseReturns,
  getPurchaseReturnById,
  updatePurchaseReturnStatus,
  updatePurchaseReturn,
  deletePurchaseReturn,
  getPurchaseReturnsByDateRange,
} from "../controllers/purchaseReturnController.js";

import protect, { checkPermission } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * Purchase Return Routes
 */

// ➕ Add purchase return
router.post("/add", protect, checkPermission("purchase_return"), addPurchaseReturn);

// 📄 Get all purchase returns
router.get("/all", protect, checkPermission("purchase_return"), getAllPurchaseReturns);

// 📅 Get purchase returns by date range
router.get("/date-range", protect, checkPermission("purchase_return"), getPurchaseReturnsByDateRange);

// 🔍 Get single purchase return
router.get("/:id", protect, checkPermission("purchase_return"), getPurchaseReturnById);

// 🔄 Update return status (APPROVED / CANCELLED etc.)
router.put("/status/:id", protect, checkPermission("purchase_return"), updatePurchaseReturnStatus);

// ✏️ Update purchase return (items / reason)
router.put("/update/:id", protect, checkPermission("purchase_return"), updatePurchaseReturn);

// 🗑️ Delete purchase return
router.delete("/delete/:id", protect, checkPermission("purchase_return"), deletePurchaseReturn);

export default router;
