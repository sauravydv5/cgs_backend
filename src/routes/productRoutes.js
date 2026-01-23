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

import protect, { adminOnly } from "../middleware/authMiddleware.js";
import { productValidationRules } from "../validators/product.validation.js";
import requestValidator from "../middleware/requestValidator.js";

const router = express.Router();

// Admin-only routes
router.post("/", protect, adminOnly,productValidationRules,requestValidator, addProduct);

router.get("/low-stock", protect, adminOnly, getLowStockProducts);
router.put("/low-stock/settings", protect, adminOnly, updateStockAlertSettings);
router.patch("/:id/stock", protect, adminOnly, updateStock);

router.put("/:id", protect, adminOnly,productValidationRules,requestValidator, updateProduct);
router.delete("/:id", protect, adminOnly, deleteProduct);

// Public routes
router.get("/", getAllProducts);
router.get("/search", searchProducts);
router.get("/:id", getProductById);

export default router;