import express from "express";
import protect, { checkPermission } from "../middleware/authMiddleware.js";
import { getDashboardData, getDashboardDataByDateRange, getSalesChart} from "../controllers/dashboardController.js";

const router = express.Router();

router.get("/get", protect, checkPermission("dashboard"), getDashboardData);
router.get("/date-range", getDashboardDataByDateRange);
router.get("/sales-chart", protect, checkPermission("dashboard"), getSalesChart);

export default router;
