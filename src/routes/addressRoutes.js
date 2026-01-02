import express from "express";
import {
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress
} from "../controllers/addressController.js";
import protect from "../middleware/authMiddleware.js";

import { latlongValidation } from "../validators/address.validation.js";
import requestValidator from "../middleware/requestValidator.js";

const router = express.Router();

router.get("/", protect, getAddresses);
router.post("/", protect, latlongValidation, requestValidator, addAddress);
router.put("/:id", protect, latlongValidation, requestValidator, updateAddress);
router.delete("/:id", protect, deleteAddress);

export default router;
