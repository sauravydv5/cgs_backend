import Product from "../models/product.js";
import StockAlert from "../models/stock.js";
import responseHandler from "../utils/responseHandler.js";
import mongoose from "mongoose";

// Add new product (admin only)
export const addProduct = async (req, res) => {
  try {
    const { category, ...rest } = req.body;
    const product = new Product({ ...rest, category });
    const savedProduct = await product.save();
    // Populate category to return the full object instead of just the ID
    const populatedProduct = await Product.findById(savedProduct._id).populate("category");

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
    const product = await Product.findById(req.params.id).populate("category");
    if (!product)
      return res.status(404).json(responseHandler.error("Product not found"));
    return res.json(responseHandler.success(product, "Product retrieved successfully"));
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

// ⚠️ Get Low Stock Products & Settings
export const getLowStockProducts = async (req, res) => {
  try {
    // Get settings or create default
    let settings = await StockAlert.findOne();
    if (!settings) {
      settings = await StockAlert.create({});
    }

    const threshold = settings.threshold;

    const products = await Product.find({ stock: { $lte: threshold } })
      .select("productName stock brandName itemCode image")
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

// ⚙️ Update Stock Alert Settings
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

// ⚡ Quick Stock Update
export const updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { stock } = req.body;
    const product = await Product.findByIdAndUpdate(id, { stock: Number(stock) }, { new: true });
    if (!product) return res.status(404).json(responseHandler.error("Product not found"));
    return res.json(responseHandler.success(product, "Stock updated successfully"));
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

// Get all products (public)
export const getAllProducts = async (req, res) => {
  try {
    const { page, limit, offset } = req;
    // Extract query params
    const {
      sortBy = "createdAt",
      sortOrder = "desc",
      category,
      brandName,
      minPrice,
      maxPrice,
      discount,
      search
    } = req.query;

    // Build filter
    const filter = {};

    if (category && mongoose.Types.ObjectId.isValid(category)) {
      filter.category = new mongoose.Types.ObjectId(category);
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

    // Sorting
    const sortOptions = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

    // Query DB with filters, sorting, and pagination
    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("category", "name") // only fetch category name
        .select(
          "brandName productName mrp discount stock image description category packSize size hsnCode itemCode costPrice gst"
        ) // ✅ only expose safe fields
        .sort(sortOptions)
        .skip(offset)
        .limit(limit),
      Product.countDocuments(filter),
    ]);

    const response = {
      rows: products,
      count: total,
      currentPage: page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };

    return res.json(
      responseHandler.success(response, "Products fetched successfully")
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

    // Update product fields from the request body
    Object.keys(req.body).forEach((key) => {
      product[key] = req.body[key] ?? product[key];
    });

    const updatedProduct = await product.save();
    // Re-populate the category field to ensure the full object is returned
    const populatedProduct = await Product.findById(updatedProduct._id).populate("category");

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
      .select("productName brandName mrp itemCode") // Select only fields needed for autofetch
      .limit(10); // Limit results for performance

    return res.json(
      responseHandler.success(products, "Products fetched successfully")
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};
