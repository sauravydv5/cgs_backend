import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    label: { type: String, default: "", trim: true },
    street: { type: String, default: "", trim: true },
    city: { type: String, default: "", trim: true },
    state: { type: String, default: "", trim: true },
    country: { type: String, default: "", trim: true },
    zip: { type: String, default: "", trim: true },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: undefined }
    },
    isDefault: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null }
  },
  { timestamps: true, versionKey: false }
);

addressSchema.index({ location: "2dsphere" });

const Address = mongoose.model("Address", addressSchema);
export default Address;
