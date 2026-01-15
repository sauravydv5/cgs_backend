import express from "express";
import { addSubcategory, getSubcategories } from "../controllers/subcategoryController.js";
import protect, { checkPermission } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET subcategories
router.get("/get", getSubcategories);

// ADD subcategory

router.post(
  "/add",
  protect,
  checkPermission("category"),
  addSubcategory
);

export default router;
