import express from "express";
import {
  addSaleReturn,
  getAllSaleReturns,
  getSaleReturnById,
  deleteSaleReturn,
  updateSaleReturnStatus,
  updateSaleReturn,
} from "../controllers/saleReturnController.js";
import protect, { checkPermission } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/add", protect, checkPermission("sale_return"), addSaleReturn);
router.get("/all", protect, checkPermission("sale_return"), getAllSaleReturns);
router.get("/:id", protect, checkPermission("sale_return"), getSaleReturnById);
router.put("/status/:id", protect, checkPermission("sale_return"), updateSaleReturnStatus);
router.put("/update/:id", protect, checkPermission("sale_return"), updateSaleReturn);
router.delete("/delete/:id", protect, checkPermission("sale_return"), deleteSaleReturn);

export default router;