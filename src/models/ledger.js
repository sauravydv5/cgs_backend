// models/Ledger.js
import mongoose from "mongoose";

const ledgerSchema = new mongoose.Schema({
  date: {
    type: Date,
    default: Date.now,
  },

  dueDate: {
    type: Date, // optional due date
  },

  partyType: {
    type: String, // "customer" | "supplier"
    enum: ["customer", "supplier"],
  },

  partyCode: {
    type: String,
    trim: true,
  },

  partyName: {
    type: String,
    trim: true,
  },

  mobileNumber: {
    type: String,
    default: null,
    trim: true,
  },

  type: {
    type: String, // "Sale" | "Payment" | "Purchase" | "Receipt"
    trim: true,
  },

  referenceNo: {
    type: String,
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
