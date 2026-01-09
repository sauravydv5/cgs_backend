// controllers/ledgerController.js
import Ledger from "../models/ledger.js";
import User from "../models/user.js";
import Supplier from "../models/supplier.js";
import mongoose from "mongoose";

/**
 * Create / Add ledger entry
 * Body:
 * {
 *  partyType, partyId, partyName, mobileNumber,
 *  type, referenceNo, paymentMethod, debit, credit, dueDate
 * }
 */
export const addLedgerEntry = async (req, res) => {
  try {
    let {
      partyType,
      ledgerType, // Frontend sends this
      partyId,
      partyCode, 
      partyName,
      mobileNumber,
      type,
      referenceNo,
      paymentMethod,
      debit = 0,
      credit = 0,
      dueDate = null,
      date = null,
    } = req.body;

    // 1. Normalize partyType
    partyType = partyType || ledgerType;
    if (!partyType) {
      return res
        .status(400)
        .json({ success: false, message: "Party type is required." });
    }
    partyType = partyType.toLowerCase();

    // 2. Lookup Party Details if missing (Auto-fill name/mobile)
    if (!partyName || !mobileNumber) {
      if (partyType === "customer") {
        let user;
        if (mongoose.Types.ObjectId.isValid(partyId)) {
          user = await User.findById(partyId);
        }
        if (!user) {
          // Try finding by phoneNumber if partyId looks like a phone number
          user = await User.findOne({ phoneNumber: partyId });
        }

        // Try finding by customerCode
        if (!user) {
          user = await User.findOne({ customerCode: partyId });
        }

        // Try finding by name (First Name or Last Name)
        if (!user) {
          user = await User.findOne({
            $or: [
              { firstName: { $regex: new RegExp(partyId, "i") } },
              { lastName: { $regex: new RegExp(partyId, "i") } },
            ],
          });
        }

        if (user) {
          partyName = `${user.firstName} ${user.lastName}`.trim() || user.customerCode || user.phoneNumber;
          mobileNumber = user.phoneNumber;

          // Ensure customerCode exists (generate if missing)
          if (!user.customerCode) {
            await user.save();
          }

          partyCode = user.customerCode; // CUST-001
        } else {
          return res
            .status(404)
            .json({ success: false, message: `Customer '${partyId}' not found.` });
        }
      } else if (partyType === "supplier") {
        let supplier;
        if (mongoose.Types.ObjectId.isValid(partyId)) {
          supplier = await Supplier.findById(partyId);
        }
        if (!supplier) {
          // Try finding by custom supplierId (e.g. CGS001)
          supplier = await Supplier.findOne({ supplierId: partyId });
        }
        if (!supplier) {
          // Try finding by name
          supplier = await Supplier.findOne({
            name: { $regex: new RegExp(`^${partyId}$`, "i") },
          });
        }

        if (supplier) {
          partyName = supplier.name;
          mobileNumber = supplier.mobileNumber;
          partyCode = supplier.supplierId;
        } else {
          return res
            .status(404)
            .json({ success: false, message: "Supplier not found." });
        }
      }
    }

    if (!partyType || !partyCode || !partyName || !type || !referenceNo) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields." });
    }

    // Fetch newest balance for this party
    const lastEntry = await Ledger.findOne({ partyCode }).sort({
      date: -1,
      createdAt: -1,
    });

    const lastBalance = lastEntry ? lastEntry.balance || 0 : 0;

    // 3. Calculate New Balance based on Party Type
    let newBalance = 0;
    if (partyType === "customer") {
      // Customer: Debit (Receivable) increases balance, Credit (Receipt) decreases balance
      newBalance = lastBalance + Number(debit || 0) - Number(credit || 0);
    } else {
      // Supplier: Credit (Payable) increases balance, Debit (Payment) decreases balance
      newBalance = lastBalance + Number(credit || 0) - Number(debit || 0);
    }

    const entry = new Ledger({
      date: date ? new Date(date) : undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      partyType,
      partyCode,
      partyName,
      mobileNumber,
      type,
      referenceNo,
      paymentMethod,
      debit: Number(debit || 0),
      credit: Number(credit || 0),
      balance: newBalance,
    });

    await entry.save();

    return res
      .status(201)
      .json({ success: true, message: "Entry added", entry });
  } catch (err) {
    console.error("addLedgerEntry:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get Supplier Ledger
 * Query params:
 *  search - matches partyName, partyId, referenceNo
 *  filterType - e.g. Purchase or Payment
 *  fromDate / toDate - YYYY-MM-DD (optional)
 *  page / limit - pagination (optional)
 */
export const getSupplierLedger = async (req, res) => {
  try {
    const {
      search,
      filterType,
      fromDate,
      toDate,
      page = 1,
      limit = 1000,
    } = req.query;
    const q = { partyType: "supplier" };

    if (search) {
      q.$or = [
        { partyName: { $regex: search, $options: "i" } },
        { partyCode: { $regex: search, $options: "i" } },
        { referenceNo: { $regex: search, $options: "i" } },
      ];
    }

    if (filterType && filterType.trim() !== "") {
      q.type = filterType;
    }

    if ((fromDate && fromDate !== "") || (toDate && toDate !== "")) {
      q.date = {};
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      if (fromDate && fromDate !== "") {
        const start = new Date(fromDate);
        if (start > today) return res.status(400).json({ success: false, message: "Future dates are not allowed" });
        q.date.$gte = start;
      }

      if (toDate && toDate !== "") {
        const d = new Date(toDate);
        d.setHours(23, 59, 59, 999);
        if (d > today) return res.status(400).json({ success: false, message: "Future dates are not allowed" });
        q.date.$lte = d;
      }

      if (q.date.$gte && q.date.$lte) {
        if (q.date.$lte < q.date.$gte) {
          return res.status(400).json({ success: false, message: "End date cannot be prior to start date" });
        }
      }
    }

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

    const [data, totalCount] = await Promise.all([
      Ledger.find(q)
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Ledger.countDocuments(q),
    ]);

    // Calculate Totals for the current filtered view (Aggregation)
    const totalsAgg = await Ledger.aggregate([
      { $match: q },
      {
        $group: {
          _id: null,
          totalDebit: { $sum: "$debit" },
          totalCredit: { $sum: "$credit" },
        },
      },
    ]);

    const totalDebit = totalsAgg[0]?.totalDebit || 0;
    const totalCredit = totalsAgg[0]?.totalCredit || 0;

    // Calculate Global Payable (Net Balance of all suppliers)
    const payableAgg = await Ledger.aggregate([
      { $match: { partyType: "supplier" } },
      { $sort: { date: 1, createdAt: 1 } },
      {
        $group: {
          _id: "$partyCode",
          lastBalance: { $last: "$balance" },
        },
      },
      {
        $group: {
          _id: null,
          totalPayable: { $sum: "$lastBalance" },
        },
      },
    ]);

    const netBalance = payableAgg[0]?.totalPayable || 0;

    return res.json({
      success: true,
      totalCount,
      page: Number(page),
      limit: Number(limit),
      totalDebit,
      totalCredit,
      netBalance,
      ledger: data,
    });
  } catch (err) {
    console.error("getSupplierLedger:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get Customer Ledger
 * Query params same as supplier endpoint
 */
export const getCustomerLedger = async (req, res) => {
  try {
    const {
      search,
      filterType,
      fromDate,
      toDate,
      page = 1,
      limit = 1000,
    } = req.query;
    const q = { partyType: "customer" };

    if (search) {
      q.$or = [
        { partyName: { $regex: search, $options: "i" } },
        { partyCode: { $regex: search, $options: "i" } },
        { referenceNo: { $regex: search, $options: "i" } },
      ];
    }

    if (filterType) q.type = filterType;

    if (fromDate || toDate) {
      q.date = {};
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      if (fromDate) {
        const start = new Date(fromDate);
        if (start > today) return res.status(400).json({ success: false, message: "Future dates are not allowed" });
        q.date.$gte = start;
      }
      if (toDate) {
        const d = new Date(toDate);
        d.setHours(23, 59, 59, 999);
        if (d > today) return res.status(400).json({ success: false, message: "Future dates are not allowed" });
        q.date.$lte = d;
      }

      if (q.date.$gte && q.date.$lte) {
        if (q.date.$lte < q.date.$gte) {
          return res.status(400).json({ success: false, message: "End date cannot be prior to start date" });
        }
      }
    }

    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);

    const [data, totalCount] = await Promise.all([
      Ledger.find(q)
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Ledger.countDocuments(q),
    ]);

    // Calculate Totals for the current y
    // filtered view (Aggregation)
    const totalsAgg = await Ledger.aggregate([
      { $match: q },
      {
        $group: {
          _id: null,
          totalDebit: { $sum: "$debit" },
          totalCredit: { $sum: "$credit" },
        },
      },
    ]);

    const totalDebit = totalsAgg[0]?.totalDebit || 0;
    const totalCredit = totalsAgg[0]?.totalCredit || 0;

    // Calculate Global Receivables (Outstanding Balance of all customers)
    const receivablesAgg = await Ledger.aggregate([
      { $match: { partyType: "customer" } },
      { $sort: { date: 1, createdAt: 1 } },
      { $group: { _id: "$partyCode", lastBalance: { $last: "$balance" } } },
      {
        $group: {
          _id: null,
          totalReceivable: { $sum: "$lastBalance" },
          countWithBalance: { $sum: { $cond: [{ $ne: ["$lastBalance", 0] }, 1, 0] } }
        }
      }
    ]);

    const totalReceivable = receivablesAgg[0]?.totalReceivable || 0;
    const customersWithBalanceCount = receivablesAgg[0]?.countWithBalance || 0;

    return res.json({
      success: true,
      totalCount,
      page: Number(page),
      limit: Number(limit),
      totalDebit,
      totalCredit,
      totalSales: totalDebit, // Alias for frontend
      totalReceivable,        // Global outstanding balance
      customersWithBalance: customersWithBalanceCount,
      ledger: data,
    });
  } catch (err) {
    console.error("getCustomerLedger:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Get Ledger Entries by Date Range
 * Query params:
 *  startDate - YYYY-MM-DD
 *  endDate - YYYY-MM-DD
 *  partyType - 'customer' or 'supplier' (optional)
 */
export const getLedgerByDateRange = async (req, res) => {
  try {
    const { startDate, endDate, partyType } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and End date are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format",
      });
    }

    end.setHours(23, 59, 59, 999); // Include the full end day

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (start > today || end > today) {
      return res.status(400).json({
        success: false,
        message: "Future dates are not allowed",
      });
    }

    if (end < start) {
      return res.status(400).json({ success: false, message: "End date cannot be prior to start date" });
    }

    const query = { date: { $gte: start, $lte: end } };
    if (partyType) query.partyType = partyType;

    const entries = await Ledger.find(query).sort({ date: -1 });

    res.json({ success: true, data: entries });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
