import express from "express";
import protect, { checkPermission } from "../middleware/authMiddleware.js";
import {
  getAllCustomers,
  updateCustomerStatus,
  deleteCustomer,
  addCustomer,
  getCustomersByRating,
  getCustomersByDateRange,
  updateCustomerRating,
} from "../controllers/customerController.js";

const router = express.Router();

router.post("/", protect, checkPermission("customer"), addCustomer);
router.get("/date-range", protect, checkPermission("customer"), getCustomersByDateRange);
router.get("/rating", protect, checkPermission("customer"), getCustomersByRating);
router.get("/", protect, checkPermission("customer"), getAllCustomers);
router.patch("/:customerId/rating", protect, checkPermission("customer"), updateCustomerRating);
router.patch("/:customerId/status", protect, checkPermission("customer"), updateCustomerStatus);
router.delete("/:customerId", protect, checkPermission("customer"), deleteCustomer);

export default router;
