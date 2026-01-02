
import express from "express";
import { allReports, getReportsByDateRange } from "../controllers/reportController.js";
import protect, { checkPermission } from "../middleware/authMiddleware.js";

const router = express.Router();

/* ================= ALL REPORTS ROUTE ================= */
router.get("/all", protect, checkPermission("report"), allReports);

/* ================= DATE RANGE REPORTS ROUTE ================= */
router.get("/date-range", protect, checkPermission("report"), getReportsByDateRange);

export default router;
