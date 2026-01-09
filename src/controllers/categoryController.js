import mongoose, { mongo } from "mongoose";
import Category from "../models/category.js";
import responseHandler from "../utils/responseHandler.js";

export const getCategories = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const matchStage = {};
    if (req.query.name) {
      matchStage.name = { $regex: req.query.name, $options: "i" };
    }

    if (req.query.parent) {
      matchStage.parent = new mongoose.Types.ObjectId(req.query.parent);
    }

    const aggregationPipeline = [
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          data: [
            { $skip: offset },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                name: 1,
                parent: 1,
                description: 1,
                createdAt: 1,
                updatedAt: 1
              }
            }
          ],
          totalCount: [
            { $count: "count" }
          ]
        }
      }
    ];

    const results = await Category.aggregate(aggregationPipeline);

    const [result] = results;

    return res.json(
      responseHandler.success(
        {
          rows: result.data,
          total: result.totalCount[0]?.count || 0,
          page,
          limit
        },
        "Categories retrieved successfully"
      )
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};


// Add new category or subcategory
export const addCategory = async (req, res) => {
  try {
    const { name, description, parent } = req.body;

    if (parent) {
      // Validate parent exists
      const parentCategory = await Category.findById(parent);
      if (!parentCategory) {
        return res.status(400).json(responseHandler.error("Parent category not found"));
      }
    }

    const newCategory = new Category({
      name,
      description,
      parent: parent || null
    });

    const savedCategory = await newCategory.save();

    return res
      .status(201)
      .json(responseHandler.success(savedCategory, "Category added successfully"));
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

// Update category
export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, parent } = req.body;

    if (parent && parent === id) {
      return res
        .status(400)
        .json(responseHandler.error("Category cannot be its own parent"));
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { name, description, parent: parent || null },
      { new: true }
    );

    if (!updatedCategory) {
      return res.status(404).json(responseHandler.error("Category not found"));
    }

    return res.json(responseHandler.success(updatedCategory, "Category updated successfully"));
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

// Delete category (and its subcategories)
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Delete all subcategories too
    await Category.deleteMany({ parent: id });

    const deletedCategory = await Category.findByIdAndDelete(id);
    if (!deletedCategory) {
      return res.status(404).json(responseHandler.error("Category not found"));
    }

    return res.json(responseHandler.success(null, "Category and subcategories deleted successfully"));
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};


// delete a subcategory by id
export const deleteSubcategory = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedSubcategory = await Category.findByIdAndDelete(id);
    if (!deletedSubcategory) {
      return res.status(404).json(responseHandler.error("Subcategory not found"));
    }
    return res.json(responseHandler.success(null, "Subcategory deleted successfully"));
  }
  catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};