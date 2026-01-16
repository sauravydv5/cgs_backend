import Product from "../models/product.js";
import Subcategory from "../models/subcategory.js";
import Category from "../models/category.js";
import StockAlert from "../models/stock.js";
import responseHandler from "../utils/responseHandler.js";
import mongoose from "mongoose";

// Helper to safely extract ID from object or string
const resolveId = (data) => {
  if (!data) return null;
  if (typeof data === "object") {
    return data._id || data.id || data.value || null;
  }
  // Handle "null" or "undefined" strings often sent by FormData
  if (typeof data === "string") {
    const trimmed = data.trim();
    if (trimmed === "null" || trimmed === "undefined" || trimmed === "") return null;
    return trimmed;
  }
  return data;
};

// Add new product (admin only)
export const addProduct = async (req, res) => {
  try {
    let { category, subcategory, ...rest } = req.body;

    // Resolve IDs safely
    category = resolveId(category);
    subcategory = resolveId(subcategory);

    // Validate Subcategory if provided
    if (subcategory && mongoose.Types.ObjectId.isValid(subcategory)) {
      const subCatExists = await Subcategory.findById(subcategory);
      if (!subCatExists) return res.status(400).json(responseHandler.error("Invalid Subcategory ID"));
    }

    const product = new Product({ ...rest, category, subcategory });
    const savedProduct = await product.save();
    
    // Populate category and subcategory
    const populatedProduct = await Product.findById(savedProduct._id)
      .populate("category", "name")
      .populate({
        path: "subcategory",
        select: "name category",
        populate: {
          path: "category",
          select: "name"
        }
      });

    return res
      .status(201)
      .json(responseHandler.success(populatedProduct, "Product added successfully"));
  } catch (err) {
    return res.status(400).json(responseHandler.error(err.message));
  }
};

// Get product by ID (public)
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("category", "name")
      .populate({
        path: "subcategory",
        select: "name category",
        populate: {
          path: "category",
          select: "name"
        }
      });
    
    if (!product)
      return res.status(404).json(responseHandler.error("Product not found"));
    return res.json(responseHandler.success(product, "Product retrieved successfully"));
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

// Get Low Stock Products & Settings
export const getLowStockProducts = async (req, res) => {
  try {
    let settings = await StockAlert.findOne();
    if (!settings) {
      settings = await StockAlert.create({});
    }

    const threshold = settings.threshold;

    const products = await Product.find({ stock: { $lte: threshold } })
      .select("productName stock brandName itemCode image")
      .populate("category", "name")
      .populate({
        path: "subcategory",
        select: "name category",
        populate: {
          path: "category",
          select: "name"
        }
      })
      .sort({ stock: 1 })
      .limit(20);

    return res.json(
      responseHandler.success({
        products,
        settings
      }, "Low stock products retrieved successfully")
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

// Update Stock Alert Settings
export const updateStockAlertSettings = async (req, res) => {
  try {
    const { threshold, emailAlert, pushAlert } = req.body;
    
    let settings = await StockAlert.findOne();
    if (!settings) {
      settings = new StockAlert();
    }

    if (threshold !== undefined) settings.threshold = threshold;
    if (emailAlert !== undefined) settings.emailAlert = emailAlert;
    if (pushAlert !== undefined) settings.pushAlert = pushAlert;

    await settings.save();

    return res.json(
      responseHandler.success(settings, "Stock alert settings updated successfully")
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

// Quick Stock Update
export const updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { stock } = req.body;
    const product = await Product.findByIdAndUpdate(
      id, 
      { stock: Number(stock) }, 
      { new: true }
    )
    .populate("category", "name")
    .populate({
      path: "subcategory",
      select: "name category",
      populate: {
        path: "category",
        select: "name"
      }
    });
    
    if (!product) return res.status(404).json(responseHandler.error("Product not found"));
    return res.json(responseHandler.success(product, "Stock updated successfully"));
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

// Get all products (public)
export const getAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = req.query.limit ? parseInt(req.query.limit) : 0;
    const offset = limit > 0 ? (page - 1) * limit : 0;
    
    const {
      sortBy = "createdAt",
      sortOrder = "desc",
      category,
      subcategory,
      brandName,
      minPrice,
      maxPrice,
      discount,
      search
    } = req.query;

    const filter = {};

    if (category && mongoose.Types.ObjectId.isValid(category)) {
      filter.category = new mongoose.Types.ObjectId(category);
    }

    if (subcategory && mongoose.Types.ObjectId.isValid(subcategory)) {
      filter.subcategory = new mongoose.Types.ObjectId(subcategory);
    }

    if (brandName) {
      filter.brandName = { $regex: brandName, $options: "i" };
    }

    if (minPrice || maxPrice) {
      filter.mrp = {};
      if (minPrice) filter.mrp.$gte = Number(minPrice);
      if (maxPrice) filter.mrp.$lte = Number(maxPrice);
    }

    if (discount) {
      filter.discount = { $regex: discount, $options: "i" };
    }

    if (search) {
      filter.$or = [
        { productName: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { brandName: { $regex: search, $options: "i" } },
      ];
    }

    const sortOptions = {
      [sortBy]: sortOrder === "asc" ? 1 : -1,
      _id: 1
    };

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("category", "name")
        .populate({
          path: "subcategory",
          select: "name category",
          populate: {
            path: "category",
            select: "name"
          }
        })
        .select(
          "brandName productName mrp discount stock image description category subcategory packSize size hsnCode itemCode costPrice gst"
        )
        .sort(sortOptions)
        .skip(offset)
        .limit(limit),
      Product.countDocuments(filter),
    ]);

    const pagination = {
      page,
      limit: limit === 0 ? total : limit,
      total,
      totalPages: limit > 0 ? Math.ceil(total / limit) : 1,
    };

    return res.json(
      responseHandler.success({ products, pagination }, "Products fetched successfully")
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

// Update product (admin only)
export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product)
      return res.status(404).json(responseHandler.error("Product not found"));

    // Explicitly handle category and subcategory updates
    if (req.body.category !== undefined) {
      product.category = resolveId(req.body.category);
    }

    if (req.body.subcategory !== undefined) {
      product.subcategory = resolveId(req.body.subcategory);
    }

    if (product.subcategory && mongoose.Types.ObjectId.isValid(product.subcategory)) {
      const subCatExists = await Subcategory.findById(product.subcategory);
      if (!subCatExists) return res.status(400).json(responseHandler.error("Invalid Subcategory ID"));
    }

    Object.keys(req.body).forEach((key) => {
      // Skip category/subcategory as they are handled above
      if (key !== "category" && key !== "subcategory") {
        product[key] = req.body[key] ?? product[key];
      }
    });

    const updatedProduct = await product.save();
    
    const populatedProduct = await Product.findById(updatedProduct._id)
      .populate("category", "name")
      .populate({
        path: "subcategory",
        select: "name category",
        populate: {
          path: "category",
          select: "name"
        }
      });

    return res.json(
      responseHandler.success(populatedProduct, "Product updated successfully")
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

// Delete product (admin only)
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product)
      return res.status(404).json(responseHandler.error("Product not found"));

    return res.json(
      responseHandler.success(null, "Product deleted successfully")
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

// Search products for autofetch (public)
export const searchProducts = async (req, res) => {
  try {
    const { term } = req.query;

    if (!term || !term.trim()) {
      return res
        .status(400)
        .json(responseHandler.error("Search term is required."));
    }

    const searchTerm = term.trim();

    const products = await Product.find({
      $or: [
        { productName: { $regex: searchTerm, $options: "i" } },
        { itemCode: { $regex: searchTerm, $options: "i" } },
      ],
    })
      .select("productName brandName mrp itemCode")
      .populate("category", "name")
      .populate({
        path: "subcategory",
        select: "name category",
        populate: {
          path: "category",
          select: "name"
        }
      })
      .limit(10);

    return res.json(
      responseHandler.success(products, "Products fetched successfully")
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};