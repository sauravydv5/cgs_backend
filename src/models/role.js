import mongoose from "mongoose";

const roleHistorySchema = new mongoose.Schema(
  {
    action: {
      type: String, // CREATED, UPDATED, STATUS_CHANGED
      required: true,
    },
    description: String,
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee", // admin employee
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const roleSchema = new mongoose.Schema(
  {
    roleName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    permissions: {
      type: [String],
      default: [],
    },
    history: [roleHistorySchema],
  },
  { timestamps: true }
);

export default mongoose.model("Role", roleSchema);
