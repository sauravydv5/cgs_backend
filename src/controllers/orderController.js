import Razorpay from "razorpay";
import crypto from "crypto";
import Cart from "../models/cart.js";
import Order from "../models/order.js";
import Product from "../models/product.js";
import Address from "../models/address.js";
import responseHandler from "../utils/responseHandler.js";
import { emitOrderStatusUpdate } from "../services/socketService.js";

// Lazy initialization of Razorpay to avoid errors on server start
let razorpayInstance = null;

const getRazorpayInstance = () => {
  if (!razorpayInstance) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new Error(
        "Razorpay credentials are not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your .env file"
      );
    }

    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }
  return razorpayInstance;
};

// Create order
export const createOrder = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1️⃣ Fetch cart
    const cart = await Cart.findOne({ user: userId }).populate("items.product");
    if (!cart || cart.items.length === 0) {
      return res.status(400).json(responseHandler.error("Cart is empty"));
    }

    // 2️⃣ Determine selected address
    let selectedAddressId = cart.selectedAddress || req.body.addressId;

    if (!selectedAddressId) {
      // Use last order's address
      const lastOrder = await Order.findOne({ user: userId }).sort({
        createdAt: -1,
      });
      if (lastOrder) {
        selectedAddressId = lastOrder.address.addressId;
      } else {
        // Use single saved address if exists
        const addresses = await Address.find({ user: userId, deletedAt: null });
        if (addresses.length === 1) {
          selectedAddressId = addresses[0]._id;
        }
      }
    }

    if (!selectedAddressId) {
      return res
        .status(400)
        .json(
          responseHandler.error(
            "Please select an address before placing the order"
          )
        );
    }

    // 3️⃣ Validate address
    const address = await Address.findOne({
      _id: selectedAddressId,
      user: userId,
      deletedAt: null,
    });
    if (!address) {
      return res
        .status(400)
        .json(responseHandler.error("Selected address is invalid"));
    }

    // Prioritize addressId from request body and update cart if different
    if (
      req.body.addressId &&
      cart.selectedAddress?.toString() !== req.body.addressId
    ) {
      const newAddress = await Address.findOne({
        _id: req.body.addressId,
        user: userId,
        deletedAt: null,
      });
      if (!newAddress) {
        return res
          .status(400)
          .json(responseHandler.error("Address from request body is invalid"));
      }

      cart.selectedAddress = newAddress._id;
      await cart.save();
    }

    // 4️⃣ Map cart items to order items
    let totalPrice = 0;
    const orderItems = cart.items.map((item) => {
      const product = item.product;

      // Calculate discounted price + tax
      let discountValue = 0;
      if (typeof product.discount === "string") {
        discountValue = parseFloat(product.discount.replace("%", "")) || 0;
      } else {
        discountValue = product.discount || 0;
      }

      const discountedPrice = product.mrp - (product.mrp * discountValue) / 100;
      const finalPrice =
        discountedPrice + (discountedPrice * (product.gst || 0)) / 100;
      totalPrice += item.quantity * finalPrice;

      return {
        productId: product._id,
        productName: product.productName,
        quantity: item.quantity,
        price: finalPrice.toFixed(2),
      };
    });

    // 5️⃣ Get payment method from request (default: razorpay)
    const paymentMethod = req.body.paymentMethod || "razorpay";

    // 6️⃣ Create order in database
    const order = new Order({
      user: userId,
      address: {
        addressId: address._id,
        street: address.street,
        city: address.city,
        state: address.state,
        zip: address.zip,
        country: address.country,
      },
      items: orderItems,
      totalPrice: totalPrice.toFixed(2),
      paymentMethod: paymentMethod,
      paymentStatus: "pending",
      tracking: {
        timeline: [
          {
            status: "Pending",
            message: "Order placed and awaiting confirmation",
            timestamp: new Date(),
          },
        ],
      },
    });

    await order.save();

    // 7️⃣ Create Razorpay order if payment method is razorpay
    if (paymentMethod === "razorpay") {
      try {
        const razorpay = getRazorpayInstance();
        const razorpayOrder = await razorpay.orders.create({
          amount: Math.round(parseFloat(totalPrice.toFixed(2)) * 100), // Convert to paise
          currency: "INR",
          receipt: `order_${order._id}`,
          notes: {
            orderId: order._id.toString(),
            userId: userId.toString(),
          },
        });

        // Update order with Razorpay order ID
        order.razorpayOrderId = razorpayOrder.id;
        await order.save();

        // Return order with Razorpay payment details
        return res.status(201).json(
          responseHandler.success(
            {
              order: order,
              razorpayOrderId: razorpayOrder.id,
              amount: razorpayOrder.amount,
              currency: razorpayOrder.currency,
              key: process.env.RAZORPAY_KEY_ID,
            },
            "Order created successfully. Please complete the payment."
          )
        );
      } catch (razorpayError) {
        // If Razorpay order creation fails, delete the order
        await Order.findByIdAndDelete(order._id);
        return res
          .status(500)
          .json(
            responseHandler.error(
              `Payment gateway error: ${razorpayError.message}`
            )
          );
      }
    } else {
      // For other payment methods (wallet, cod), just return the order
      // 8️⃣ Clear cart items but keep selectedAddress
      cart.items = [];
      await cart.save();

      return res
        .status(201)
        .json(responseHandler.success(order, "Order placed successfully"));
    }
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

// Get all orders for a user
export const getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const orders = await Order.find({ user: userId }).sort({ createdAt: -1 });

    if (!orders || orders.length === 0) {
      return res.status(404).json(responseHandler.error("No orders found"));
    }

    return res.json(
      responseHandler.success(orders, "User orders retrieved successfully")
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

// Get single order by ID
export const getOrderById = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findById(orderId).populate(
      "user",
      "firstName lastName email"
    );

    if (!order) {
      return res.status(404).json(responseHandler.error("Order not found"));
    }

    return res.json(
      responseHandler.success(order, "Order details retrieved successfully")
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

export const getAllOrdersForAdmin = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("user", "firstName lastName email") // Populate user details
      .sort({ createdAt: 1 }); // earliest first
    if (!orders || orders.length === 0) {
      return res.status(404).json(responseHandler.error("No orders found"));
    }

    return res.json(
      responseHandler.success(orders, "All orders retrieved successfully")
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

// Get order history with filtering and pagination
export const getOrderHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      status,
      paymentStatus,
      startDate,
      endDate,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build query
    const query = { user: userId };

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by payment status
    if (paymentStatus) {
      query.paymentStatus = paymentStatus;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Execute query
    const orders = await Order.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .select("-tracking.timeline"); // Exclude detailed timeline for list view

    // Get total count for pagination
    const totalOrders = await Order.countDocuments(query);
    const totalPages = Math.ceil(totalOrders / limitNum);

    // Format response
    const formattedOrders = orders.map((order) => ({
      _id: order._id,
      orderNumber: order._id.toString().slice(-8).toUpperCase(),
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      totalPrice: order.totalPrice,
      itemCount: order.items.length,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      address: {
        city: order.address.city,
        state: order.address.state,
      },
    }));

    return res.json(
      responseHandler.success(
        {
          orders: formattedOrders,
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalOrders,
            limit: limitNum,
            hasNextPage: pageNum < totalPages,
            hasPrevPage: pageNum > 1,
          },
        },
        "Order history retrieved successfully"
      )
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

// Get order tracking details
export const getOrderTracking = async (req, res) => {
  try {
    const userId = req.user.id;
    const orderId = req.params.id;

    // Find order
    const order = await Order.findOne({
      _id: orderId,
      user: userId,
    });

    if (!order) {
      return res.status(404).json(responseHandler.error("Order not found"));
    }

    // Calculate estimated delivery (7 days from order date if not set)
    let estimatedDelivery = order.tracking?.estimatedDelivery;
    if (
      !estimatedDelivery &&
      order.status !== "Delivered" &&
      order.status !== "Cancelled"
    ) {
      const deliveryDate = new Date(order.createdAt);
      deliveryDate.setDate(deliveryDate.getDate() + 7);
      estimatedDelivery = deliveryDate;
    }

    // Format tracking timeline
    const timeline = (order.tracking?.timeline || []).map((item) => ({
      status: item.status,
      message: item.message,
      timestamp: item.timestamp,
      isCompleted: true,
    }));

    // Add current status if not in timeline
    const currentStatusInTimeline = timeline.some(
      (item) => item.status === order.status
    );
    if (!currentStatusInTimeline) {
      timeline.push({
        status: order.status,
        message: `Order is currently ${order.status}`,
        timestamp: order.updatedAt || order.createdAt,
        isCompleted: order.status === "Delivered",
      });
    }

    // Sort timeline by timestamp
    timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Build response
    const trackingInfo = {
      orderId: order._id,
      orderNumber: order._id.toString().slice(-8).toUpperCase(),
      currentStatus: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      timeline: timeline,
      estimatedDelivery: estimatedDelivery,
      trackingNumber: order.tracking?.trackingNumber || null,
      carrier: order.tracking?.carrier || null,
      address: order.address,
      items: order.items.map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
      })),
      totalPrice: order.totalPrice,
      orderDate: order.createdAt,
      lastUpdated: order.updatedAt,
    };

    return res.json(
      responseHandler.success(
        trackingInfo,
        "Order tracking details retrieved successfully"
      )
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

// Cancel order (user initiated)
export const cancelOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const orderId = req.params.id;
    const reason =
      typeof req.body?.reason === "string" ? req.body.reason.trim() : "";

    const order = await Order.findOne({ _id: orderId, user: userId });

    if (!order) {
      return res.status(404).json(responseHandler.error("Order not found"));
    }

    if (order.status === "Cancelled") {
      return res
        .status(409)
        .json(responseHandler.error("Order is already cancelled"));
    }

    if (["Shipped", "Delivered"].includes(order.status)) {
      return res
        .status(400)
        .json(
          responseHandler.error(
            "Order cannot be cancelled after it has been shipped"
          )
        );
    }

    let refundDetails = null;

    if (order.paymentStatus === "completed") {
      if (order.paymentMethod === "razorpay") {
        if (!order.razorpayPaymentId) {
          return res
            .status(400)
            .json(
              responseHandler.error(
                "Payment information is missing. Please contact support to cancel this order."
              )
            );
        }

        try {
          const razorpay = getRazorpayInstance();
          const totalPriceNumber = Number(order.totalPrice);
          if (!Number.isFinite(totalPriceNumber) || totalPriceNumber <= 0) {
            return res
              .status(400)
              .json(
                responseHandler.error(
                  "Invalid order amount for refund processing"
                )
              );
          }

          refundDetails = await razorpay.payments.refund(
            order.razorpayPaymentId,
            {
              amount: Math.round(totalPriceNumber * 100),
              speed: "optimum",
              notes: {
                orderId: order._id.toString(),
                reason: reason || "User requested cancellation",
              },
            }
          );
          order.paymentStatus = "refunded";
        } catch (refundError) {
          return res
            .status(502)
            .json(
              responseHandler.error(
                `Failed to initiate refund: ${refundError.message}`
              )
            );
        }
      } else if (order.paymentMethod === "cod") {
        order.paymentStatus = "pending";
      } else {
        order.paymentStatus = "refunded";
      }
    }

    order.status = "Cancelled";

    const cancellationMessage = reason
      ? `Order cancelled by user: ${reason}`
      : "Order cancelled by user";

    order.$locals = order.$locals || {};
    order.$locals.statusMessageOverride = cancellationMessage;

    await order.save();

    // Emit real-time update via Socket.IO
    emitOrderStatusUpdate(order._id.toString(), {
      status: order.status,
      paymentStatus: order.paymentStatus,
      tracking: order.tracking,
      message: cancellationMessage,
    });

    return res.json(
      responseHandler.success(
        {
          order,
          refund: refundDetails,
        },
        "Order cancelled successfully"
      )
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

// Update order status and tracking (Admin only)
export const updateOrderStatus = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { status, trackingNumber, carrier, estimatedDelivery } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json(responseHandler.error("Order not found"));
    }

    // Store old status before updating
    const oldStatus = order.status;

    // Update status if provided
    if (status) {
      const validStatuses = [
        "Pending",
        "Processing",
        "Shipped",
        "Delivered",
        "Cancelled",
      ];
      if (!validStatuses.includes(status)) {
        return res
          .status(400)
          .json(responseHandler.error("Invalid order status"));
      }
      order.status = status;
    }

    // Update tracking information
    if (!order.tracking) {
      order.tracking = { timeline: [] };
    }

    if (trackingNumber) {
      order.tracking.trackingNumber = trackingNumber;
    }

    if (carrier) {
      order.tracking.carrier = carrier;
    }

    if (estimatedDelivery) {
      order.tracking.estimatedDelivery = new Date(estimatedDelivery);
    }

    // If status changed, add timeline entry manually (since pre-save might not trigger on direct updates)
    if (status && status !== oldStatus) {
      const statusMessages = {
        Pending: "Order placed and awaiting confirmation",
        Processing: "Order confirmed and being prepared",
        Shipped: "Order has been shipped",
        Delivered: "Order has been delivered",
        Cancelled: "Order has been cancelled",
      };

      const message =
        statusMessages[status] || `Order status changed to ${status}`;
      order.tracking.timeline.push({
        status: status,
        message: message,
        timestamp: new Date(),
      });
    }

    await order.save();

    // Emit real-time update via Socket.IO
    emitOrderStatusUpdate(order._id.toString(), {
      status: order.status,
      tracking: order.tracking,
      paymentStatus: order.paymentStatus,
      message: `Order status updated to ${order.status}`,
    });

    return res.json(
      responseHandler.success(order, "Order status updated successfully")
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

// Verify Razorpay payment
export const verifyPayment = async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    const userId = req.user.id;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res
        .status(400)
        .json(responseHandler.error("Missing payment verification details"));
    }

    // Find order by Razorpay order ID
    const order = await Order.findOne({
      razorpayOrderId: razorpayOrderId,
      user: userId,
    });

    if (!order) {
      return res.status(404).json(responseHandler.error("Order not found"));
    }

    // Verify signature
    const text = `${razorpayOrderId}|${razorpayPaymentId}`;
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(text)
      .digest("hex");

    if (generatedSignature !== razorpaySignature) {
      return res
        .status(400)
        .json(responseHandler.error("Invalid payment signature"));
    }

    // Update order with payment details
    order.razorpayPaymentId = razorpayPaymentId;
    order.razorpaySignature = razorpaySignature;
    order.paymentStatus = "completed";
    order.status = "Processing";
    await order.save();

    // Emit real-time update via Socket.IO
    emitOrderStatusUpdate(order._id.toString(), {
      status: order.status,
      paymentStatus: order.paymentStatus,
      tracking: order.tracking,
      message: "Payment verified successfully. Order is now being processed.",
    });

    // Clear cart items
    const cart = await Cart.findOne({ user: userId });
    if (cart) {
      cart.items = [];
      await cart.save();
    }

    return res.json(
      responseHandler.success(order, "Payment verified successfully")
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

// Razorpay webhook handler
export const razorpayWebhook = async (req, res) => {
  try {
    const webhookSignature = req.headers["x-razorpay-signature"];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("RAZORPAY_WEBHOOK_SECRET not configured");
      return res.status(500).json({ error: "Webhook secret not configured" });
    }

    // Get raw body for signature verification (it's a Buffer from express.raw())
    const bodyString = req.body.toString();

    // Verify webhook signature
    const generatedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(bodyString)
      .digest("hex");

    if (generatedSignature !== webhookSignature) {
      console.error("Invalid webhook signature");
      return res.status(400).json({ error: "Invalid webhook signature" });
    }

    // Parse the body after signature verification
    const body = JSON.parse(bodyString);
    const event = body.event;
    const payment = body.payload?.payment?.entity;

    if (event === "payment.captured" && payment) {
      // Find order by Razorpay order ID
      const order = await Order.findOne({
        razorpayOrderId: payment.order_id,
      });

      if (order && order.paymentStatus !== "completed") {
        order.razorpayPaymentId = payment.id;
        order.paymentStatus = "completed";
        order.status = "Processing";
        await order.save();

        // Clear cart items
        const cart = await Cart.findOne({ user: order.user });
        if (cart) {
          cart.items = [];
          await cart.save();
        }

        // Emit real-time update via Socket.IO
        emitOrderStatusUpdate(order._id.toString(), {
          status: order.status,
          paymentStatus: order.paymentStatus,
          tracking: order.tracking,
          message: "Payment captured. Order is now being processed.",
        });

        console.log(`Payment captured for order ${order._id}`);
      }
    } else if (event === "payment.failed" && payment) {
      const order = await Order.findOne({
        razorpayOrderId: payment.order_id,
      });

      if (order) {
        order.paymentStatus = "failed";
        await order.save();
        console.log(`Payment failed for order ${order._id}`);
      }
    }

    return res.json({ status: "ok" });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ error: err.message });
  }
};
