import { body } from "express-validator";

export const productValidationRules = [
  // Core fields
  body("brandName").trim().notEmpty().withMessage("Brand name is required"),
  body("productName").trim().notEmpty().withMessage("Product name is required"),
  body("category").notEmpty().withMessage("Category is required"),
  body("mrp").isFloat({ min: 0 }).withMessage("MRP must be a positive number"),
  body("costPrice").isFloat({ min: 0 }).withMessage("Cost price must be a positive number"),
  body("stock").isInt({ min: 0 }).withMessage("Stock must be a non-negative integer"),

  // Optional but common fields
  body("gst").optional().isFloat({ min: 0 }).withMessage("GST must be a non-negative number"),
  body("discount")
    .optional()
    .matches(/^(\d{1,2}(\.\d+)?%?)?$/)
    .withMessage("Discount must be a percentage (e.g., '10%' or '5.5')"),

  // Packaging details
  body("size")
    .optional()
    .matches(/^(\d+(\s?(ml|l|g|kg|pcs))?|XS|S|M|L|XL|XXL|Small|Medium|Large)$/i)
    .withMessage("Invalid size format. Example: '500ml', '1L', 'M', or 'Large'."),

  body("packSize")
    .optional()
    .matches(/^\d+(\s?(ml|l|g|kg|pcs|dozen|bottles|packs|units))?$/i)
    .withMessage("Invalid pack size format. Example: '6pcs', '12 bottles', or '1kg'."),

  body("pack")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Pack must be a positive integer (e.g., 1, 2, 3)"),

  // Miscellaneous fields
  body("hsnCode").optional().trim(),
  body("itemCode").optional().trim(),
  body("company").optional().trim(),
  body("description").optional().trim(),
  body("productStatus")
    .optional()
    .isIn(["active", "inactive"])
    .withMessage("Product status must be either 'active' or 'inactive'"),
];
