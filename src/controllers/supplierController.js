import Supplier from "../models/supplier.js";
import Purchase from "../models/purchase.js";
import PurchaseReturn from "../models/purchaseReturn.js";
import mongoose from "mongoose";

// 📊 SUPPLIER SUMMARY
export const getSupplierSummary = async (req, res) => {
  try {
    const suppliers = await Supplier.find();

    const data = await Promise.all(
      suppliers.map(async (sup) => {
        const purchases = await Purchase.countDocuments({ supplier: sup._id });
        const returns = await PurchaseReturn.countDocuments({ supplier: sup._id });

        return {
          supplierId: sup.supplierId,
          name: sup.name,
          companyName: sup.companyName,
          mobileNumber: sup.mobileNumber,
          purchases,
          returns,
        };
      })
    );

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Auto Supplier ID Generator
async function generateSupplierId() {
  // Find the last supplier created to ensure the ID is sequential and unique
  const lastSupplier = await Supplier.findOne().sort({ createdAt: -1 });

  let nextIdNumber = 1;
  if (lastSupplier && lastSupplier.supplierId) {
    // Extract the number from the last supplier's ID (e.g., "CGS005" -> 5)
    const lastIdNumber = parseInt(lastSupplier.supplierId.replace("CGS", ""), 10);
    if (!isNaN(lastIdNumber)) {
      nextIdNumber = lastIdNumber + 1;
    }
  }

  return `CGS${nextIdNumber.toString().padStart(3, "0")}`;
}

// ADD SUPPLIER
export const addSupplier = async (req, res) => {
  try {
    const { email, name, mobileNumber } = req.body;

    // Check if a supplier with the same email already exists
    if (email && email.trim() !== "") {
      const existingSupplier = await Supplier.findOne({ email });
      if (existingSupplier) {
        return res
          .status(409)
          .json({ success: false, message: "A supplier with this email already exists." });
      }
    }
    const supplierId = await generateSupplierId();

    const supplier = await Supplier.create({
      ...req.body,
      supplierId,
      name: name || "N/A",
      mobileNumber: mobileNumber || "N/A",
    });

    res.status(201).json({
      success: true,
      message: "Supplier added successfully",
      supplier,
    });
  } catch (error) {
    // Handle other potential errors, including unique constraint violations from the database
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A supplier with this information already exists.",
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET ALL SUPPLIERS
export const getSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      suppliers,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET SINGLE SUPPLIER
export const getSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid supplier id",
      });
    }

    const supplier = await Supplier.findById(id);

    if (!supplier)
      return res.status(404).json({ success: false, message: "Not found" });

    res.json({ success: true, supplier });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// UPDATE SUPPLIER
export const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    const supplier = await Supplier.findOneAndUpdate(
      { $or: [{ _id: id }, { supplierId: id }] },
      req.body,
      { new: true, runValidators: true }
    );

    if (!supplier) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    res.json({
      success: true,
      message: "Supplier updated successfully",
      supplier,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE SUPPLIER
export const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid supplier id",
      });
    }

    const supplier = await Supplier.findByIdAndDelete(id);

    if (!supplier)
      return res.status(404).json({ success: false, message: "Not found" });

    res.json({ success: true, message: "Supplier deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET SUPPLIERS BY DATE RANGE
export const getSuppliersByDateRange = async (req, res) => {
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

    const suppliers = await Supplier.find({
      createdAt: { $gte: start, $lte: end },
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      suppliers,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
