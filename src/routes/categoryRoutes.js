// import express from "express";
// import {
//   getCategories,
//   addCategory,
//   updateCategory,
//   deleteCategory,
//   deleteSubcategory
// } from "../controllers/categoryController.js";

// import protect, { checkPermission } from "../middleware/authMiddleware.js";

// const router = express.Router();

// router.get("/",getCategories);
// router.post("/", protect, checkPermission("category"), addCategory);
// router.put("/:id", protect, checkPermission("category"), updateCategory);
// router.delete("/:id", protect, checkPermission("category"), deleteCategory);
// router.delete("/subcategory/:id", protect, checkPermission("category"), deleteSubcategory);

// export default router;

import express from "express";
import { addCategory, getCategories } from "../controllers/categoryController.js";
import protect, { checkPermission } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET categories
router.get("/get", getCategories);

// ADD category
router.post(
  "/add",
  protect,
  checkPermission("category"),
  addCategory
);

export default router;

