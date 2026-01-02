import mongoose from "mongoose";
const productSchema = new mongoose.Schema(
  {
    brandName: { type: String, required: true, trim: true },
    productName: { type: String, required: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    company: { type: String, default: "", trim: true },
    mrp: { type: Number, required: true, min: 0 },
    costPrice: { type: Number, required: true, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    itemCode: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      // Auto-generate itemCode from the last 6 characters of the _id if not provided
      default: function() { return `CGS${this._id.toString().slice(-6).toUpperCase()}`; }
    },
    gst: { type: Number, default: 0, min: 0 },
    hsnCode: { type: String, default: "", trim: true },
    size: { type: String, default: "", trim: true },
    discount: { type:String, default: "" , trim: true },
    packSize: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },
    image: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("Product", productSchema);