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
      .sort({ createdAt: -1 });

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
    const { name, description, category } = req.body;

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
