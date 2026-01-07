import express from "express";
import {
  createEmployee,
  getAllEmployees,
  getEmployeeById,
  updateEmployee,
  changeEmployeeRole,
  employeeLogin,
  verifyEmployeeOtp,
  getEmployeeProfile,
} from "../controllers/employeeController.js";
import protect, { checkPermission } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public Routes (Login)
router.post("/login", employeeLogin);
router.post("/otp/verify", verifyEmployeeOtp);

router.post("/add", protect, checkPermission("employee"), createEmployee);
router.get("/all", protect, checkPermission("employee"), getAllEmployees);
router.get("/profile", protect, getEmployeeProfile);
router.get("/:id", protect, checkPermission("employee"), getEmployeeById);
router.put("/update/:id", protect, checkPermission("employee"), updateEmployee);
router.put("/change/:id/role", protect, checkPermission("employee"), changeEmployeeRole);

export default router;
