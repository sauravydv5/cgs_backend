import express from "express";
import {
  addProduct,
  getProductById,
  getAllProducts,
  updateProduct,
  deleteProduct,
  searchProducts,
  getLowStockProducts,
  updateStockAlertSettings,
  updateStock
} from "../controllers/productController.js";

import protect, { adminOnly, checkPermission } from "../middleware/authMiddleware.js";
import { productValidationRules } from "../validators/product.validation.js";
import requestValidator from "../middleware/requestValidator.js";

const router = express.Router();

// Admin-only routes
router.post("/", protect, checkPermission("product"), productValidationRules, requestValidator, addProduct);

router.get("/low-stock", protect, checkPermission("product"), getLowStockProducts);
router.put("/low-stock/settings", protect, checkPermission("product"), updateStockAlertSettings);
router.patch("/:id/stock", protect, checkPermission("product"), updateStock);

router.put("/:id", protect, checkPermission("product"), productValidationRules, requestValidator, updateProduct);
router.delete("/:id", protect, checkPermission("product"), deleteProduct);

// Public routes
router.get("/", getAllProducts);
router.get("/search", searchProducts);
router.get("/:id", getProductById);

export default router;
