import express from "express";
import protect, { checkPermission } from "../middleware/authMiddleware.js";
import { getDashboardData } from "../controllers/dashboardController.js";

const router = express.Router();

router.get("/get", protect, checkPermission("dashboard"), getDashboardData);

export default router;
