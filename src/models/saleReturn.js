import mongoose from "mongoose";

const saleReturnSchema = new mongoose.Schema(
  {
    returnId: {
      type: String,
      required: true,
      unique: true, // e.g., RET-001
    },
    billId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "bill", // References the 'bill' model
      required: true,
    },
    billNo: {
      type: String, // Stores "BILL-XXXX" for easier display
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    customerName: {
      type: String,
      default: "",
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        qty: {
          type: Number,
          required: true,
        },
        rate: {
          type: Number,
          required: true,
        },
        amount: {
          type: Number,
          required: true,
        },
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
  },
  { timestamps: true }
);

export default mongoose.model("SaleReturn", saleReturnSchema);