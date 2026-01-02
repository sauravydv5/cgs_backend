import { body, param } from "express-validator";
import mongoose from "mongoose";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

// 🛒 Add to cart validation
export const addToCartValidation = [
  body("productId")
    .notEmpty()
    .withMessage("Product ID is required")
    .custom((value) => isValidObjectId(value))
    .withMessage("Invalid Product ID format"),
];

// ⬆️ Increment item quantity
export const incrementItemValidation = [
  param("itemId")
    .notEmpty()
    .withMessage("Item ID is required")
    .custom((value) => isValidObjectId(value))
    .withMessage("Invalid Item ID format"),
];

// ⬇️ Decrement item quantity
export const decrementItemValidation = [
  param("itemId")
    .notEmpty()
    .withMessage("Item ID is required")
    .custom((value) => isValidObjectId(value))
    .withMessage("Invalid Item ID format"),
];

// ❌ Remove item
export const removeItemValidation = [
  param("itemId")
    .notEmpty()
    .withMessage("Item ID is required")
    .custom((value) => isValidObjectId(value))
    .withMessage("Invalid Item ID format"),
];

// 🧹 Clear cart doesn’t need extra validation (userId comes from JWT)