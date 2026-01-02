import mongoose from "mongoose";

const supplierSchema = new mongoose.Schema(
  {
    supplierId: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    mobileNumber: {
      type: String,
      required: true,
    },
    email: String,
    companyName: String,
    city: String,
    state: String,
    address: String,
    gstHolder: {
      type: String, // YES / NO
    },
    purchases: {
      type: Number,
      default: 0,
    },
    returns: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Supplier", supplierSchema);
