import PurchaseReturn from "../models/purchaseReturn.js";
import Purchase from "../models/purchase.js";
import Product from "../models/product.js";
import Supplier from "../models/supplier.js";
// import Ledger from "../models/ledger.js";

export const addPurchaseReturn = async (req, res) => {
  try {
    const { purchase, date, items, reason, status } = req.body;

    if (!purchase || !date || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Purchase, date and items are required",
      });
    }

    const purchaseDoc = await Purchase.findById(purchase);
    if (!purchaseDoc) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    // 🔹 Generate Return ID
    const last = await PurchaseReturn.findOne().sort({ createdAt: -1 });
    const nextNo = last ? Number(last.returnId.replace("PR", "")) + 1 : 1;
    const returnId = `PR${String(nextNo).padStart(4, "0")}`;

    let totalAmount = 0;
    const mappedItems = [];

    // 🔄 Process returned items
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      const amount = item.qty * item.rate;
      totalAmount += amount;

      // 🔥 Reduce stock
      product.stock -= item.qty;
      await product.save();

      mappedItems.push({
        product: product._id,
        qty: item.qty,
        rate: item.rate,
        amount,
      });
    }

    const supplierDoc = await Supplier.findById(purchaseDoc.supplier);

    const purchaseReturn = await PurchaseReturn.create({
      returnId,
      purchase,
      supplier: purchaseDoc.supplier,
      supplierName: supplierDoc?.name || "",
      date,
      items: mappedItems,
      totalAmount,
      reason,
      status: status || "PENDING",
    });

    // // 🔹 Ledger entry (Supplier Debit)
    // await Ledger.create({
    //   partyType: "supplier",
    //   partyCode: supplierDoc.supplierId,
    //   partyName: supplierDoc.name,
    //   mobileNumber: supplierDoc.mobileNumber,
    //   type: "Purchase Return",
    //   referenceNo: returnId,
    //   debit: totalAmount,
    // });

    res.status(201).json({
      success: true,
      message: "Purchase return added successfully",
      data: purchaseReturn,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAllPurchaseReturns = async (req, res) => {
  const returns = await PurchaseReturn.find()
    .populate("supplier", "name supplierId")
    .populate("purchase", "purchaseId")
    .populate("items.product", "productName itemCode")
    .sort({ createdAt: -1 });

  res.json({ success: true, data: returns });
};

export const getPurchaseReturnById = async (req, res) => {
  try {
    const { id } = req.params;
    const purchaseReturn = await PurchaseReturn.findById(id)
      .populate("supplier", "name supplierId mobileNumber")
      .populate("purchase", "purchaseId")
      .populate("items.product", "productName itemCode");

    if (!purchaseReturn) {
      return res.status(404).json({ success: false, message: "Purchase return not found" });
    }

    res.json({ success: true, data: purchaseReturn });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePurchaseReturnStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const purchaseReturn = await PurchaseReturn.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!purchaseReturn) {
      return res.status(404).json({ success: false, message: "Purchase return not found" });
    }

    res.json({ success: true, message: "Status updated successfully", data: purchaseReturn });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePurchaseReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedReturn = await PurchaseReturn.findByIdAndUpdate(
      id,
      req.body,
      { new: true }
    );

    if (!updatedReturn) {
      return res.status(404).json({ success: false, message: "Purchase return not found" });
    }

    res.json({ success: true, message: "Purchase return updated successfully", data: updatedReturn });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deletePurchaseReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const purchaseReturn = await PurchaseReturn.findById(id);

    if (!purchaseReturn) {
      return res.status(404).json({ success: false, message: "Purchase return not found" });
    }

    // Rollback stock (Add qty back since return reduced it)
    for (const item of purchaseReturn.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.qty },
      });
    }

    await PurchaseReturn.findByIdAndDelete(id);

    res.json({ success: true, message: "Purchase return deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET PURCHASE RETURNS BY DATE RANGE
export const getPurchaseReturnsByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

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

    const returns = await PurchaseReturn.find({
      date: { $gte: start, $lte: end },
    })
      .populate("supplier", "name supplierId")
      .populate("purchase", "purchaseId")
      .populate("items.product", "productName itemCode")
      .sort({ date: -1 });

    res.json({
      success: true,
      data: returns,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
