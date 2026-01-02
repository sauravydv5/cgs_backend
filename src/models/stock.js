import mongoose from "mongoose";

const stockAlertSchema = new mongoose.Schema({
  threshold: { type: Number, default: 10 },
  emailAlert: { type: Boolean, default: true },
  pushAlert: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model("StockAlert", stockAlertSchema);