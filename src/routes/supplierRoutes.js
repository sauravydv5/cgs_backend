import express from "express";
import {
  addSupplier,
  getSuppliers,
  getSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierSummary,
  getSuppliersByDateRange,
} from "../controllers/supplierController.js";
import protect, { checkPermission } from "../middleware/authMiddleware.js";

const router = express.Router();
// 📊 Purchasers Detail Screen
router.get("/summary", protect, checkPermission("supplier"), getSupplierSummary);

router.get("/date-range", protect, checkPermission("supplier"), getSuppliersByDateRange);
// Supplier CRUD
router.post("/add", protect, checkPermission("supplier"), addSupplier);
router.get("/get/all", protect, checkPermission("supplier"), getSuppliers);
router.get("/get/:id", protect, checkPermission("supplier"), getSupplier);
router.put("/update/:id", protect, checkPermission("supplier"), updateSupplier);
router.delete("/delete/:id", protect, checkPermission("supplier"), deleteSupplier);

export default router;