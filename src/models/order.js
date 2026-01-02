import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // Mandatory address snapshot
  address: {
    addressId: { type: mongoose.Schema.Types.ObjectId, ref: "Address" },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zip: { type: String, required: true },
    country: { type: String, required: true }
  },

  // Items snapshot
  items: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, required: true },
      productName: { type: String, required: true },
      quantity: { type: Number, required: true },
      price: { type: Number, required: true } // final price per unit
    }
  ],

  // Pricing
  totalPrice: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },

  // Order status
  status: {
    type: String,
    enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"],
    default: "Pending"
  },

  // Payment information
  paymentMethod: {
    type: String,
    enum: ["razorpay", "wallet", "cod"],
    default: "razorpay"
  },
  paymentStatus: {
    type: String,
    enum: ["pending", "processing", "completed", "failed", "refunded"],
    default: "pending"
  },
  razorpayOrderId: {
    type: String,
    default: null
  },
  razorpayPaymentId: {
    type: String,
    default: null
  },
  razorpaySignature: {
    type: String,
    default: null
  },

  // Tracking timeline
  tracking: {
    timeline: [
      {
        status: { type: String, required: true },
        message: { type: String, required: true },
        timestamp: { type: Date, default: Date.now }
      }
    ],
    estimatedDelivery: { type: Date, default: null },
    trackingNumber: { type: String, default: null },
    carrier: { type: String, default: null }
  }

}, { timestamps: true });

// Indexes for faster queries
OrderSchema.index({ user: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ "tracking.trackingNumber": 1 });

// Pre-save middleware to automatically add tracking timeline entries
OrderSchema.pre("save", function(next) {
  if (this.isModified("status") && !this.isNew) {
    const statusMessages = {
      "Pending": "Order placed and awaiting confirmation",
      "Processing": "Order confirmed and being prepared",
      "Shipped": "Order has been shipped",
      "Delivered": "Order has been delivered",
      "Cancelled": "Order has been cancelled"
    };

    const overrideMessage = this.$locals?.statusMessageOverride;
    const message = overrideMessage || statusMessages[this.status] || `Order status changed to ${this.status}`;
    
    if (!this.tracking) {
      this.tracking = { timeline: [] };
    }
    
    // Add timeline entry if status changed
    this.tracking.timeline.push({
      status: this.status,
      message: message,
      timestamp: new Date()
    });
  }
  next();
});

export default mongoose.model("Order", OrderSchema);
