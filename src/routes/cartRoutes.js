import express from "express";
import {
  addToCart,
  getCart,
  incrementItem,
  decrementItem,
  removeItem,
  clearCart,
  selectAddress
} from "../controllers/cartController.js";
import protect from "../middleware/authMiddleware.js";
import requestValidator from "../middleware/requestValidator.js";
import { addToCartValidation,
    incrementItemValidation,
    decrementItemValidation,
    removeItemValidation,

 }
  from "../validators/cart.validation.js";

const router = express.Router();

router.post("/", protect, addToCartValidation, requestValidator, addToCart);
router.get("/", protect, getCart);
router.patch("/select-address", protect, selectAddress);
router.patch("/:itemId/increment", protect, incrementItemValidation,requestValidator,incrementItem);
router.patch("/:itemId/decrement", protect,decrementItemValidation ,requestValidator, decrementItem);
router.delete("/:itemId", protect,removeItemValidation,requestValidator, removeItem);

router.delete("/", protect, clearCart);

export default router;
