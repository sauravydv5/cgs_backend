// routes/ledgerRoutes.js
import express from "express";
import {
  addLedgerEntry,
  getCustomerLedger,
  getSupplierLedger,
  getLedgerByDateRange,
} from "../controllers/ledgerController.js";
import protect, { checkPermission } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * POST /api/ledger/add
 * Add single ledger entry (sale/purchase/payment/receipt)
 */
router.post("/add", protect, checkPermission("ledger"), addLedgerEntry);

/**
 * GET /api/ledger/supplier
 * Query params: search, filterType, fromDate, toDate, page, limit
 */
router.get("/supplier", protect, checkPermission("ledger"), getSupplierLedger);

/**
 * GET /api/ledger/customer
 * Query params: search, filterType, fromDate, toDate, page, limit
 */
router.get("/customer", protect, checkPermission("ledger"), getCustomerLedger);

/**
 * GET /api/ledger/date-range
 * Query params: startDate, endDate, partyType (optional)
 */
router.get("/date-range", protect, checkPermission("ledger"), getLedgerByDateRange);

export default router;
