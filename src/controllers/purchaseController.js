// import mongoose from "mongoose";
// import Purchase from "../models/purchase.js";
// import Product from "../models/product.js";
// import Supplier from "../models/supplier.js";

// // add a new purchase
// export const addPurchase = async (req, res) => {
//   try {

//     // Validate items array to prevent crashes
//     if (!req.body.items || !Array.isArray(req.body.items) || req.body.items.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Please provide at least one item in the purchase.",
//       });
//     }

//     // Auto-generate purchaseId if not provided
//     let purchaseId = req.body.purchaseId;
//     if (!purchaseId) {
//       const lastPurchase = await Purchase.findOne().sort({ createdAt: -1 });
//       let nextNum = 1;
//       if (lastPurchase && lastPurchase.purchaseId) {
//         const match = lastPurchase.purchaseId.match(/(\d+)$/);
//         if (match) {
//           nextNum = parseInt(match[1], 10) + 1;
//         }
//       }
//       purchaseId = `PUR${String(nextNum).padStart(4, "0")}`;
//     }

//     const mappedItems = req.body.items.map((item) => ({
//       product: item.product,
//       qty: item.quantity,   // 🔥 FIX HERE
//       rate: item.rate,
//       amount: item.amount,
//     }));

//     // Calculate totalAmount if not provided
//     let totalAmount = req.body.totalAmount;
//     if (totalAmount === undefined || totalAmount === null) {
//       totalAmount = mappedItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
//     }

//     // 🔍 Handle Supplier Logic
//     let supplierId = req.body.supplier;
//     let supplierName = req.body.supplierName || "";

//     // If supplier is provided but NOT a valid ObjectId, assume it's a name and try to find the ID
//     if (supplierId && !mongoose.Types.ObjectId.isValid(supplierId)) {
//       const supplierDoc = await Supplier.findOne({
//         name: { $regex: new RegExp(`^${supplierId}$`, "i") }
//       });
//       if (supplierDoc) {
//         supplierId = supplierDoc._id;
//         supplierName = supplierDoc.name;
//       } else {
//         supplierId = null; // Invalid ID and not found as name
//       }
//     } else if (supplierId) {
//       // If ID is provided, fetch name to ensure it's saved
//       const supplierDoc = await Supplier.findById(supplierId);
//       if (supplierDoc) supplierName = supplierDoc.name;
//     }

//     // If supplier ID is missing/empty, try to find by name
//     if (!supplierId && supplierName) {
//       const supplierDoc = await Supplier.findOne({
//         name: { $regex: new RegExp(`^${supplierName}$`, "i") }
//       });
//       if (supplierDoc) {
//         supplierId = supplierDoc._id;
//         supplierName = supplierDoc.name;
//       }
//     }

//     if (!supplierId) {
//       return res.status(400).json({
//         success: false,
//         message: "Supplier is required. Please select a valid supplier.",
//       });
//     }

//     const purchase = await Purchase.create({
//       purchaseId,
//       billNo: req.body.billNo || purchaseId,
//       supplier: supplierId,
//       supplierName: supplierName,
//       date: req.body.date,
//       items: mappedItems,
//       totalAmount: totalAmount,
//       paymentMethod: req.body.paymentMethod || "Cash",
//       status: req.body.status || "PAID",
//     });

//     // Populate supplier details for the response
//     await purchase.populate("supplier", "name email mobileNumber companyName");

//     res.status(201).json({
//       success: true,
//       data: purchase,
//     });
//   } catch (error) {
//     res.status(400).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };


// // get all purchases
// export const getAllPurchases = async (req, res) => {
//   try {
//     const purchases = await Purchase.find()
//       .populate("supplier", "name email mobileNumber companyName")
//       .sort({ createdAt: -1 });
//     res.json({
//       success: true,
//       data: purchases,
//     });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

// UPDATE PURCHASE
export const updatePurchase = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedPurchase = await Purchase.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedPurchase) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found",
      });
    }

    res.json({
      success: true,
      data: updatedPurchase,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// // DELETE PURCHASE
// // DELETE PURCHASE
// export const deletePurchase = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const deletedPurchase = await Purchase.findByIdAndDelete(id);

//     if (!deletedPurchase) {
//       return res.status(404).json({
//         success: false,
//         message: "Purchase not found",
//       });
//     }

//     res.json({
//       success: true,
//       message: "Purchase deleted successfully",
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// };

// // GET SINGLE PURCHASE BY ID
// export const getPurchaseById = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const purchase = await Purchase.findById(id).populate("supplier", "name email mobileNumber companyName");

//     if (!purchase) {
//       return res.status(404).json({ success: false, message: "Purchase not found" });
//     }

//     res.json({
//       success: true,
//       data: purchase,
//     });
//   } catch (error) {
//     res.status(500).json({ success: false, message: error.message });
//   }
// };

import Purchase from "../models/purchase.js";
import Product from "../models/product.js";
import Supplier from "../models/supplier.js";
// import Ledger from "../models/ledger.js";
 // GET PURCHASE VOUCHERS (FOR DASHBOARD / VOUCHER LIST)
export const getPurchaseVouchers = async (req, res) => {
  try {
    const vouchers = await Purchase.find()
      .populate("supplier", "name companyName")
      .sort({ createdAt: -1 });

    const data = vouchers.map(v => ({
      purchaseId: v.purchaseId,
      billNo: v.billNo,
      date: v.date,
      supplierName: v.supplier?.name || v.supplierName || "N/A",
      totalAmount: v.totalAmount || 0,
    }));

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};




export const addPurchase = async (req, res) => {
  try {
    const { supplier, date, items, paymentMethod, status, billNo } = req.body;

    if (!supplier || !date || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Supplier, date and items are required",
      });
    }

    // 🔹 Generate Purchase ID
    const last = await Purchase.findOne().sort({ createdAt: -1 });
    const nextNo = last ? Number(last.purchaseId.replace("PUR", "")) + 1 : 1;
    const purchaseId = `PUR${String(nextNo).padStart(4, "0")}`;

    let totalAmount = 0;
    const mappedItems = [];

    // 🔹 Process items
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found",
        });
      }

      // Support both 'qty' and 'quantity'
      const qty = Number(item.qty || item.quantity || 0);
      const rate = Number(item.rate || 0);

      const amount = qty * rate;
      totalAmount += amount;

      // 🔥 Increase stock
      product.stock += qty;
      product.costPrice = rate;
      await product.save();

      mappedItems.push({
        product: product._id,
        qty: qty,
        rate: rate,
        amount,
      });
    }

    const supplierDoc = await Supplier.findById(supplier);
    if (!supplierDoc) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found",
      });
    }

    const purchase = await Purchase.create({
      purchaseId,
      billNo: billNo || purchaseId, // Use provided billNo or fallback to system ID
      supplier,
      supplierName: supplierDoc.name,
      date,
      items: mappedItems,
      totalAmount,
      paymentMethod,
      status,
    });

    // // 🔹 Ledger entry (Supplier Payable)
    // await Ledger.create({
    //   partyType: "supplier",
    //   partyCode: supplierDoc.supplierId,
    //   partyName: supplierDoc.name,
    //   mobileNumber: supplierDoc.mobileNumber,
    //   type: "Purchase",
    //   referenceNo: purchaseId,
    //   credit: totalAmount,
    //   paymentMethod,
    // });

    // 🔥 Populate purchase items for response
    const populatedPurchase = await Purchase.findById(purchase._id)
      .populate("supplier", "name email mobileNumber companyName")
      .populate("items.product", "productName itemCode brandName");

    res.status(201).json({
      success: true,
      message: "Purchase added successfully",
      data: populatedPurchase,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAllPurchases = async (req, res) => {
  const purchases = await Purchase.find()
    .populate("supplier", "name supplierId")
    .populate("items.product", "productName itemCode")
    .sort({ createdAt: -1 });

  res.json({ success: true, data: purchases });
};

export const getPurchaseById = async (req, res) => {
  const purchase = await Purchase.findById(req.params.id)
    .populate("supplier")
    .populate("items.product");

  if (!purchase) {
    return res.status(404).json({
      success: false,
      message: "Purchase not found",
    });
  }

  res.json({ success: true, data: purchase });
};


export const deletePurchase = async (req, res) => {
  const purchase = await Purchase.findById(req.params.id);

  if (!purchase) {
    return res.status(404).json({
      success: false,
      message: "Purchase not found",
    });
  }

  // 🔄 Rollback stock
  for (const item of purchase.items) {
    await Product.findByIdAndUpdate(item.product, {
      $inc: { stock: -item.qty },
    });
  }

  await purchase.deleteOne();

  res.json({
    success: true,
    message: "Purchase deleted successfully",
  });
};

// GET PURCHASE VOUCHER DATA (For New Voucher Page)
export const getPurchaseVoucher = async (req, res) => {
  try {
    // Generate Next Purchase ID
    const lastPurchase = await Purchase.findOne().sort({ createdAt: -1 });
    let nextId = "PUR0001";
    if (lastPurchase && lastPurchase.purchaseId) {
      const match = lastPurchase.purchaseId.match(/(\d+)$/);
      if (match) {
        const nextNum = parseInt(match[1], 10) + 1;
        nextId = `PUR${String(nextNum).padStart(4, "0")}`;
      }
    }

    // Fetch Suppliers and Products for dropdowns
    const suppliers = await Supplier.find({}).select("name companyName supplierId mobileNumber");
    const products = await Product.find({}).select("productName brandName itemCode mrp costPrice stock");

    // Return template data
    const voucherData = {
      purchaseId: nextId,
      billNo: nextId,
      date: new Date(),
      supplier: "",
      supplierName: "",
      items: [],
      allSuppliers: suppliers,
      allProducts: products
    };

    res.status(200).json({
      success: true,
      data: [voucherData]
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET PURCHASES BY DATE RANGE
export const getPurchasesByDateRange = async (req, res) => {
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

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (start > today || end > today) {
      return res.status(400).json({
        success: false,
        message: "Future dates are not allowed",
      });
    }

    if (end < start) {
      return res.status(400).json({
        success: false,
        message: "End date cannot be prior to start date",
      });
    }

    const purchases = await Purchase.find({
      date: { $gte: start, $lte: end },
    })
      .populate("supplier", "name supplierId")
      .populate("items.product", "productName itemCode")
      .sort({ date: -1 });

    res.json({
      success: true,
      data: purchases,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
