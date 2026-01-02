// models/Ledger.js
import mongoose from "mongoose";

const ledgerSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },

  dueDate: {
    type: Date, // optional due date
  },

  partyType: {
    type: String, // "customer" | "supplier"
    required: true,
    enum: ["customer", "supplier"],
  },

  partyCode: {
    type: String,
    required: true,
    trim: true,
  },

  partyName: {
    type: String,
    required: true,
    trim: true,
  },

  mobileNumber: {
    type: String,
    default: null,
    trim: true,
  },

  type: {
    type: String, // "Sale" | "Payment" | "Purchase" | "Receipt"
    required: true,
    trim: true,
  },

  referenceNo: {
    type: String,
    required: true,
    trim: true,
  },

  paymentMethod: {
    type: String, // Cash | Credit | UPI etc.
    default: "Credit",
  },

  debit: {
    type: Number,
    default: 0,
    min: 0,
  },

  credit: {
    type: Number,
    default: 0,
    min: 0,
  },

  balance: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

const Ledger = mongoose.model("Ledger", ledgerSchema);
export default Ledger;
