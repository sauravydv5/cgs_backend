import mongoose from "mongoose";
import Subcategory from "../models/subcategory.js";
import Category from "../models/category.js";
import responseHandler from "../utils/responseHandler.js";

// GET subcategories
export const getSubcategories = async (req, res) => {
  try {
    const filter = {};

    if (req.query.categoryId) {
      filter.category = req.query.categoryId;
    }

    const subcategories = await Subcategory
      .find(filter)
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .lean();

    return res.json(
      responseHandler.success(subcategories, "Subcategories fetched successfully")
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

// ADD subcategory
export const addSubcategory = async (req, res) => {
  try {
    let { name, description, category, categoryId } = req.body;

    // Handle if category is sent as categoryId or inside an object
    if (!category && categoryId) category = categoryId;
    
    // Extract ID if category is an object (handle _id or id)
    if (category && typeof category === "object") {
      category = category._id || category.id || category.value;
    }

    // Ensure it's a string and trim whitespace
    if (category && typeof category === "string") {
      category = category.trim();
      if (category === "null" || category === "undefined" || category === "") category = null;
    }

    if (!category || !mongoose.Types.ObjectId.isValid(category)) {
      return res
        .status(400)
        .json(responseHandler.error("Valid Category ID is required"));
    }

    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res
        .status(400)
        .json(responseHandler.error("Category not found"));
    }

    const subcategory = await Subcategory.create({
      name,
      description,
      category
    });

    return res.status(201).json(
      responseHandler.success(subcategory, "Subcategory added successfully")
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};
