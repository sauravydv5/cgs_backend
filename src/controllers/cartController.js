import Address from "../models/address.js";
import Order from "../models/order.js";
import Cart from "../models/cart.js";
import Product from "../models/product.js";
import responseHandler from "../utils/responseHandler.js";
import mongoose from "mongoose";

// 🛒 Add product to cart
export const addToCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productId } = req.body;

    const product = await Product.findById(productId);
    if (!product)
      return res.status(404).json(responseHandler.error("Product not found"));

    if (product.stock < 1)
      return res.status(400).json(responseHandler.error("Product out of stock"));

    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      cart = new Cart({
        user: userId,
        items: [{ product: productId, quantity: 1 }],
      });
    } else {
      const existingItem = cart.items.find(
        (item) => item.product.toString() === productId
      );
      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        cart.items.push({ product: productId, quantity: 1 });
      }
    }

    await Product.findByIdAndUpdate(productId, { $inc: { stock: -1 } });
    await cart.save();

    const populatedCart = await cart.populate([
      { path: "items.product" },
      { path: "selectedAddress" },
    ]);

    return res.json(
      responseHandler.success(populatedCart, "Product added to cart")
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

// 🧺 Get user's cart
export const getCart = async (req, res) => {
  try {
    const userId = req.user.id;

    const results = await Cart.aggregate([
      {
        $match: { user: new mongoose.Types.ObjectId(userId) }
      },

      {
        $unwind: {
          path: "$items",
          preserveNullAndEmptyArrays: true
        }
      },

      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "product"
        }
      },

      {
        $addFields: {
          "items.product": { $arrayElemAt: ["$product", 0] }
        }
      },

      {
        $lookup: {
          from: "addresses",
          localField: "selectedAddress",
          foreignField: "_id",
          as: "selectedAddress"
        }
      },

      {
        $addFields: {
          selectedAddress: { $arrayElemAt: ["$selectedAddress", 0] }
        }
      },

      {
        $group: {
          _id: "$_id",
          user: { $first: "$user" },
          items: { $push: "$items" },
          selectedAddress: { $first: "$selectedAddress" },
          createdAt: { $first: "$createdAt" },
          updatedAt: { $first: "$updatedAt" }
        }
      }
    ]);

    let cart = null;
    if (!results.length)
      cart = await getDefaultUserCart(userId);
    else
      cart = results[0];

    return res.json(responseHandler.success(cart, "Cart retrieved successfully"));
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

// ➕ Increment cart item
export const incrementItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;

    const cart = await Cart.findOne({ user: userId }).populate("items.product");
    if (!cart)
      return res.status(404).json(responseHandler.error("Cart not found"));

    const item = cart.items.id(itemId);
    if (!item)
      return res.status(404).json(responseHandler.error("Item not found"));

    if (!item.product || item.product.stock < 1)
      return res.status(400).json(responseHandler.error("Not enough stock"));

    // Update quantity and stock
    item.quantity += 1;
    await Product.findByIdAndUpdate(item.product._id, { $inc: { stock: -1 } });

    await cart.save();

    const populatedCart = await cart.populate("items.product");
    return res.json(
      responseHandler.success(populatedCart, "Item quantity incremented")
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};


// ➖ Decrement cart item
export const decrementItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;

    const cart = await Cart.findOne({ user: userId }).populate("items.product");
    if (!cart)
      return res.status(404).json(responseHandler.error("Cart not found"));

    const item = cart.items.id(itemId);
    if (!item)
      return res.status(404).json(responseHandler.error("Item not found"));

    const productId = item.product._id;

    if (item.quantity > 1) {
      item.quantity -= 1;
      await Product.findByIdAndUpdate(productId, { $inc: { stock: 1 } });
    } else {
      await Product.findByIdAndUpdate(productId, {
        $inc: { stock: item.quantity },
      });
      item.deleteOne();
    }

    await cart.save();

    const populatedCart = await cart.populate("items.product");
    return res.json(
      responseHandler.success(populatedCart, "Item quantity decremented")
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};
// ❌ Remove an item
export const removeItem = async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;

    const cart = await Cart.findOne({ user: userId })
      .populate("items.product")
      .populate("selectedAddress");
    if (!cart)
      return res.status(404).json(responseHandler.error("Cart not found"));

    const item = cart.items.id(itemId);
    if (item) {
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { stock: item.quantity },
      });
      item.deleteOne();
    }

    await cart.save();
    const populatedCart = await cart.populate("items.product").populate("selectedAddress");
    return res.json(
      responseHandler.success(populatedCart, "Item removed from cart")
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

// 🧹 Clear entire cart (keep selected address)
export const clearCart = async (req, res) => {
  try {
    const userId = req.user.id;
    const cart = await Cart.findOne({ user: userId })
      .populate("items.product")
      .populate("selectedAddress");

    if (cart) {
      for (const item of cart.items) {
        await Product.findByIdAndUpdate(item.product._id, {
          $inc: { stock: item.quantity },
        });
      }
      cart.items = [];
      // ❌ keep selectedAddress — don't clear it
      await cart.save();
    }

    return res.json(
      responseHandler.success(cart, "Cart cleared successfully")
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

// 📍 Select/update address
export const selectAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { addressId } = req.body;

    const cart = await Cart.findOne({ user: userId });
    if (!cart)
      return res.status(404).json(responseHandler.error("Cart not found"));


    await Cart.updateOne({ user: userId }, { $set: { selectedAddress: addressId } });

    return res.status(200).json(responseHandler.success(cart, "Address selected for cart"));
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

const getDefaultUserCart = async (userId) => {
  const defaultAddress = await Address.findOne({ user: userId, isDefault: true, deletedAt: null });

  return Cart.create({
    user: userId,
    items: [],
    selectedAddress: defaultAddress ? defaultAddress._id : null
  })
}