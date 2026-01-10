import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
    description: { type: String, default: "", trim: true },
  },
  { timestamps: true, versionKey: false }
);

const Category = mongoose.model("Category", categorySchema);

// Drop the unique index on 'name' if it exists (to allow duplicate names)
Category.collection.dropIndex("name_1").catch(() => {});

export default Category;