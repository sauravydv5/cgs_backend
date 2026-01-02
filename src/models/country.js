import mongoose from "mongoose";

const countrySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    code: {
      type: String,
      required: true,
      trim: true,
      unique: true
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model("Country", countrySchema);
