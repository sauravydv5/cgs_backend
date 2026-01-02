import express from "express";
import protect, { checkPermission } from "../middleware/authMiddleware.js";
import {
  getAllCustomers,
  updateCustomerStatus,
  deleteCustomer,
  addCustomer,
  getCustomersByRating,
  getCustomersByDateRange,
} from "../controllers/customerController.js";
import { addCustomerValidation } from "../validators/user.validation.js";
import requestValidator from "../middleware/requestValidator.js";

const router = express.Router();

router.post("/", protect, checkPermission("customer"), addCustomerValidation, requestValidator, addCustomer);
router.get("/date-range", protect, checkPermission("customer"), getCustomersByDateRange);
router.get("/rating", protect, checkPermission("customer"), getCustomersByRating);
router.get("/", protect, checkPermission("customer"), getAllCustomers);
router.patch("/:customerId/status", protect, checkPermission("customer"), updateCustomerStatus);
router.delete("/:customerId", protect, checkPermission("customer"), deleteCustomer);

export default router;
