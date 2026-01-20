import Bill from "../models/bill.js";
import Product from "../models/product.js";
import User from "../models/user.js";
import mongoose from "mongoose";

/* ================= CREATE BILL ================= */

export const addBill = async (req, res) => {
  try {
    const {
      billDate,
      items,
      paymentMode,
      paidAmount = 0,
      roundOff = 0,
      notes,
      paymentStatus: providedStatus,
      customerName,
      customerPhone,
    } = req.body;

    let customerId = req.body.customerId || req.params.customerId;

    if (customerId && !mongoose.Types.ObjectId.isValid(customerId)) {
      customerId = null;
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Items required" });
    }

    /* ---------- CUSTOMER ---------- */
    if (!customerId) {
      const validPhone =
        customerPhone &&
        customerPhone !== "undefined" &&
        customerPhone !== "null"
          ? customerPhone
          : null;

      let customer = validPhone
        ? await User.findOne({ phoneNumber: validPhone })
        : null;

      if (!customer) {
        customer = await User.create({
          firstName: customerName || "Customer",
          phoneNumber: validPhone,
        });
      }
      customerId = customer._id;
    }

    const round2 = (n) => Math.round(n * 100) / 100;

    let finalItems = [];
    let totalQty = 0;
    let grossAmount = 0;
    let totalDiscount = 0;
    let taxableAmount = 0;
    let totalCGST = 0;
    let totalSGST = 0;

    /* ---------- ITEMS LOOP ---------- */
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      const qty = Number(item.qty || 0);
      const rate = Number(item.rate || product.mrp);
      const discountPercent = Number(
        item.discountPercent ?? product.discount ?? 0
      );
      const gstPercent = Number(product.gst || 0);

      const gross = round2(rate * qty);
      const discountAmount = round2((gross * discountPercent) / 100);
      const taxable = round2(gross - discountAmount);

      const gstAmount = round2((taxable * gstPercent) / 100);
      const cgst = round2(gstAmount / 2);
      const sgst = round2(gstAmount / 2);

      const total = round2(taxable + gstAmount);

      finalItems.push({
        productId: product._id,
        itemCode: product.itemCode,
        itemName: product.productName,
        hsnCode: product.hsnCode,

        qty,
        rate,

        grossAmount: gross,
        discountPercent,
        discountAmount,

        taxableAmount: taxable,
        gstPercent,

        cgst,
        sgst,
        igst: 0,
        total,
      });

      totalQty += qty;
      grossAmount = round2(grossAmount + gross);
      totalDiscount = round2(totalDiscount + discountAmount);
      taxableAmount = round2(taxableAmount + taxable);
      totalCGST = round2(totalCGST + cgst);
      totalSGST = round2(totalSGST + sgst);
    }

    /* ---------- BILL NO ---------- */
    const lastBill = await Bill.findOne().sort({ createdAt: -1 });
    const nextNum = lastBill
      ? Number(lastBill.billNo.replace("BILL", "")) + 1
      : 1;

    const billNo = `BILL${String(nextNum).padStart(4, "0")}`;

    const netAmount = round2(
      taxableAmount + totalCGST + totalSGST + roundOff
    );
    const balanceAmount = round2(netAmount - paidAmount);

    let paymentStatus =
      providedStatus === "Draft"
        ? "Draft"
        : balanceAmount === 0
        ? "Paid"
        : paidAmount > 0
        ? "Partial"
        : "Unpaid";

    const finalBillDate = billDate
      ? billDate
      : new Date(Date.now() + 5.5 * 60 * 60 * 1000);

    const bill = await Bill.create({
      customerId,
      billNo,
      billDate: finalBillDate,
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

    await bill.populate("customerId", "firstName lastName phoneNumber");

    res.status(201).json({
      success: true,
      message: "Bill generated successfully",
      bill,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ================= GET DRAFT BILLS ================= */

export const getDraftBills = async (req, res) => {
  try {
    const bills = await Bill.find({
      paymentStatus: { $in: ["Draft", "Unpaid"] },
    })
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
      const start = new Date(from);
      const end = new Date(to);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }

      end.setHours(23, 59, 59, 999); // Ensure end date covers the full day

      const today = new Date();
      today.setHours(23, 59, 59, 999);

      if (start > today || end > today) {
        return res
          .status(400)
          .json({ message: "Future dates are not allowed" });
      }
      if (end < start) {
        return res
          .status(400)
          .json({ message: "End date cannot be prior to start date" });
      }

      filter.billDate = {
        $gte: start,
        $lte: end,
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
    const customerId = req.params.customerId || req.params.id;
    if (!customerId) {
      return res.status(400).json({ message: "Customer ID is required" });
    }

    const bills = await Bill.find({ customerId })
      .populate("customerId", "firstName lastName phoneNumber")
      .sort({ billDate: -1 });

    if (!bills || bills.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No bills found for this customer" });
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
    if (!bill) return res.status(404).json({ message: "Bill not found" });

    const round2 = (n) => Math.round(n * 100) / 100;

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

      const discountPercent = Number(item.discountPercent || 0);
      const discountAmount = round2((rate * qty * discountPercent) / 100);

      const gross = round2(rate * qty);
      const taxable = round2(gross - discountAmount);

      const gstPercent = String(item.hsnCode) === "3304" ? 5 : 3;

      const cgst = round2((taxable * gstPercent) / 200);
      const sgst = round2((taxable * gstPercent) / 200);
      const igst = round2(item.igst || 0);

      const total = round2(taxable + cgst + sgst + igst);

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
        discountPercent,
        discountAmount,
        taxableAmount: taxable,
        cgst,
        sgst,
        igst,
        total,
      };
    });

    const netAmount = round2(
      taxableAmount + totalCGST + totalSGST + totalIGST + (roundOff || 0)
    );

    const balanceAmount = round2(netAmount - (paidAmount || 0));

    let paymentStatus = providedStatus === "Draft" ? "Draft" : null;

    if (!paymentStatus) {
      paymentStatus =
        balanceAmount === 0 ? "Paid" : paidAmount > 0 ? "Partial" : "Unpaid";
    }

    bill.customerId = customerId;
    bill.agentId = agentId;
    bill.billNo = billNo;
    if (billDate) bill.billDate = billDate;
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
    res.json({
      success: true,
      message: "Bill payment status updated successfully",
      bill,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
