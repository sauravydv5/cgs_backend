import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    description: { type: String, default: "", trim: true },
  },
  { timestamps: true, versionKey: false }
);

export default mongoose.model("Category", categorySchema);