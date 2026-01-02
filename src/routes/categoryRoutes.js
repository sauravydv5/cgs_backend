import express from "express";
import {
  getCategories,
  addCategory,
  updateCategory,
  deleteCategory,
  deleteSubcategory
} from "../controllers/categoryController.js";

import protect, { checkPermission } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/",getCategories);
router.post("/", protect, checkPermission("category"), addCategory);
router.put("/:id", protect, checkPermission("category"), updateCategory);
router.delete("/:id", protect, checkPermission("category"), deleteCategory);
router.delete("/subcategory/:id", protect, checkPermission("category"), deleteSubcategory);

export default router;
