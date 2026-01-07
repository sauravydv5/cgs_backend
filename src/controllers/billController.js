import Bill from "../models/bill.js";
import Product from "../models/product.js";
import mongoose from "mongoose";

/* ================= CREATE BILL ================= */

export const addBill = async (req, res) => {
  try {
    const {
      billDate,
      items,
      paymentMode,
      paidAmount,
      roundOff,
      notes,
      paymentStatus: providedStatus,
    } = req.body;

    const customerId = req.body.customerId || req.params.customerId;

    if (!customerId || !items?.length) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    /* 🔹 ROUNDING HELPER */
    const round2 = (n) => Math.round(n * 100) / 100;

    let finalItems = [];

    let totalQty = 0;
    let grossAmount = 0;
    let totalDiscount = 0;
    let taxableAmount = 0;
    let totalCGST = 0;
    let totalSGST = 0;

    for (const item of items) {
      let product = null;

      /* 🔹 FIND PRODUCT */
      if (item.productId) {
        const pId = String(item.productId).trim();
        if (mongoose.Types.ObjectId.isValid(pId)) {
          product = await Product.findById(pId);
        }
        if (!product) {
          product = await Product.findOne({ itemCode: pId });
        }
      }

      if (!product && item.itemCode) {
        product = await Product.findOne({ itemCode: item.itemCode });
      }

      if (!product) {
        return res.status(404).json({
          message: `Product not found for ${item.productId || item.itemCode}`,
        });
      }

      /* 🔹 CALCULATIONS */
      const qty = Number(item.qty || 0);
      const rate = Number(item.rate || product.mrp);
      const discountAmount = Number(item.discountAmount || 0);

      const gross = round2(rate * qty);
      const taxable = round2(gross - discountAmount);

      const gstPercent = Number(product.gst || 0);

      const cgst = round2((taxable * gstPercent) / 200);
      const sgst = round2((taxable * gstPercent) / 200);

      const total = round2(taxable + cgst + sgst);

      /* 🔹 FINAL ITEM SNAPSHOT */
      finalItems.push({
        productId: product._id,
        sno: item.sno,

        itemCode: product.itemCode,
        itemName: product.productName,
        companyName: product.brandName,

        hsnCode: product.hsnCode,
        packing: product.packSize,
        batch: item.batch || "",

        qty,
        freeQty: item.freeQty || 0,

        mrp: product.mrp,
        rate,

        discountPercent: Number(product.discount || 0),
        discountAmount,

        taxableAmount: taxable,
        gstPercent,
        cgst,
        sgst,
        igst: 0,

        total,
      });

      /* 🔹 RUNNING TOTALS (ROUNDED) */
      totalQty += qty;
      grossAmount = round2(grossAmount + gross);
      totalDiscount = round2(totalDiscount + discountAmount);
      taxableAmount = round2(taxableAmount + taxable);
      totalCGST = round2(totalCGST + cgst);
      totalSGST = round2(totalSGST + sgst);
    }

    /* ================= GENERATE BILL NO ================= */
    const lastBill = await Bill.findOne().sort({ createdAt: -1 });
    let nextNum = 1;
    if (lastBill && lastBill.billNo) {
      const match = lastBill.billNo.match(/(\d+)$/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    const newBillNo = `BILL${String(nextNum).padStart(4, "0")}`;

    const netAmount = round2(
      taxableAmount + totalCGST + totalSGST + (roundOff || 0)
    );

    const balanceAmount = round2(netAmount - (paidAmount || 0));

    // Use provided status if it is "Draft", otherwise calculate based on payment
    let paymentStatus = providedStatus === "Draft" ? "Draft" : null;

    if (!paymentStatus) {
      paymentStatus =
        balanceAmount === 0
          ? "Paid"
          : paidAmount > 0
          ? "Partial"
          : "Unpaid";
    }

    const bill = await Bill.create({
      customerId,
      billNo: newBillNo,
      billDate,
      items: finalItems,

      totalQty,
      grossAmount,
      totalDiscount,
      taxableAmount,
      totalCGST,
      totalSGST,
      totalIGST: 0,
      roundOff,
      netAmount,

      paymentMode,
      paidAmount,
      balanceAmount,
      paymentStatus,

      notes,
    });

    // Populate customer details for the response
    await bill.populate("customerId", "firstName lastName phoneNumber email");

    res.status(201).json({
      success: true,
      message: `Bill generated successfully: ${bill.billNo}`,
      bill,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


/* ================= GET DRAFT BILLS ================= */
export const getDraftBills = async (req, res) => {
  try {
    const bills = await Bill.find({ paymentStatus: "Draft" })
      .populate("customerId", "firstName lastName phoneNumber")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, bills });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ================= GET ALL BILLS ================= */
export const getBills = async (req, res) => {
  try {
    const bills = await Bill.find()
      .populate("customerId", "firstName lastName phoneNumber gstNumber")
      .populate("agentId", "name")
      .sort({ createdAt: -1 });

    res.json(bills);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ================= GET SINGLE BILL ================= */
export const getBillById = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id)
      .populate("customerId")
      .populate("agentId")
      .populate("items.productId");

    if (!bill) {
      return res.status(404).json({ message: "Bill not found" });
    }

    res.json(bill);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ================= DATE RANGE ================= */
export const getBillsByDateRange = async (req, res) => {
  try {
    const { from, to } = req.query;

    const filter = {};
    if (from && to) {
      filter.billDate = {
        $gte: new Date(from),
        $lte: new Date(to),
      };
    }

    const bills = await Bill.find(filter)
      .populate("customerId", "firstName lastName phoneNumber gstNumber")
      .populate("agentId", "name")
      .sort({ billDate: -1 });

    res.json(bills);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ================= GET BILLS BY CUSTOMER ================= */
export const getBillsByCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;
    if (!customerId) {
      return res.status(400).json({ message: "Customer ID is required" });
    }

    const bills = await Bill.find({ customerId })
      .populate("customerId", "firstName lastName phoneNumber")
      .sort({ billDate: -1 });

    if (!bills || bills.length === 0) {
      return res.status(404).json({ success: false, message: "No bills found for this customer" });
    }

    res.status(200).json({ success: true, bills });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateBill = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      customerId,
      agentId,
      billNo,
      billDate,
      items,
      paymentMode,
      paidAmount,
      roundOff,
      notes,
      paymentStatus: providedStatus,
    } = req.body;

    const bill = await Bill.findById(id);
    if (!bill) {
      return res.status(404).json({ message: "Bill not found" });
    }

    /* 🔹 ROUNDING HELPER */
    const round2 = (n) => Math.round(n * 100) / 100;

    /* ---------- RECALCULATE TOTALS ---------- */
    let totalQty = 0;
    let grossAmount = 0;
    let totalDiscount = 0;
    let taxableAmount = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;

    const updatedItems = items.map((item) => {
      const qty = Number(item.qty || 0);
      const rate = Number(item.rate || item.mrp || 0);
      const discountAmount = Number(item.discountAmount || 0);
      const gstPercent = Number(item.gstPercent || 0);

      const gross = round2(rate * qty);
      const taxable = round2(gross - discountAmount);

      const cgst = round2((taxable * gstPercent) / 200);
      const sgst = round2((taxable * gstPercent) / 200);
      const igst = round2(item.igst || 0);

      const total = round2(taxable + cgst + sgst + igst);

      /* 🔹 RUNNING TOTALS */
      totalQty += qty;
      grossAmount = round2(grossAmount + gross);
      totalDiscount = round2(totalDiscount + discountAmount);
      taxableAmount = round2(taxableAmount + taxable);
      totalCGST = round2(totalCGST + cgst);
      totalSGST = round2(totalSGST + sgst);
      totalIGST = round2(totalIGST + igst);

      return {
        ...item,
        qty,
        rate,
        discountAmount,
        taxableAmount: taxable,
        cgst,
        sgst,
        igst,
        total,
      };
    });

    const netAmount = round2(
      taxableAmount +
        totalCGST +
        totalSGST +
        totalIGST +
        (roundOff || 0)
    );

    const balanceAmount = round2(netAmount - (paidAmount || 0));

    // Use provided status if it is "Draft", otherwise calculate based on payment
    let paymentStatus = providedStatus === "Draft" ? "Draft" : null;

    if (!paymentStatus) {
      paymentStatus =
        balanceAmount === 0
          ? "Paid"
          : paidAmount > 0
          ? "Partial"
          : "Unpaid";
    }

    /* ---------- UPDATE ---------- */
    bill.customerId = customerId;
    bill.agentId = agentId;
    bill.billNo = billNo;
    bill.billDate = billDate;
    bill.items = updatedItems;

    bill.totalQty = totalQty;
    bill.grossAmount = grossAmount;
    bill.totalDiscount = totalDiscount;
    bill.taxableAmount = taxableAmount;
    bill.totalCGST = totalCGST;
    bill.totalSGST = totalSGST;
    bill.totalIGST = totalIGST;
    bill.roundOff = roundOff;
    bill.netAmount = netAmount;

    bill.paymentMode = paymentMode;
    bill.paidAmount = paidAmount;
    bill.balanceAmount = balanceAmount;
    bill.paymentStatus = paymentStatus;

    bill.notes = notes;

    await bill.save();

    res.json({ success: true, bill });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



export const deleteBill = async (req, res) => {
  try {
    const { id } = req.params;

    const bill = await Bill.findById(id);
    if (!bill) {
      return res.status(404).json({ message: "Bill not found" });
    }

    await bill.deleteOne();

    res.json({ success: true, message: "Bill deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateBillPaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus } = req.body;

    const bill = await Bill.findByIdAndUpdate(
      id.trim(),
      { paymentStatus },
      { new: true, runValidators: true }
    );

    if (!bill) {
      return res.status(404).json({ message: "Bill not found" });
    }
    res.json({ success: true, message: "Bill payment status updated successfully", bill });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
