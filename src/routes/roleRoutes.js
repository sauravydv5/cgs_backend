import express from "express";
import {
  createRole,
  updateRole,
  getAllRoles,
  getRoleById,
  getRoleHistory,
} from "../controllers/roleController.js";
import protect, { checkPermission } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/add", protect, checkPermission("role"), createRole);
router.get("/all", protect, checkPermission("role"), getAllRoles);
router.get("/:id", protect, checkPermission("role"), getRoleById);
router.put("/update/:id", protect, checkPermission("role"), updateRole);
router.get("/:id/history", protect, checkPermission("role"), getRoleHistory);

export default router;
