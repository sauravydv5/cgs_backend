import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const employeeSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
    },
    lastName: String,

    email: {
      type: String,
      required: true,
      unique: true,
    },

    phoneNumber: String,

    password: {
      type: String,
      required: true,
    },

    role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
    zone: {
      type: String,
    },

    status: {
      type: Boolean,
      default: true, // Active / Inactive switch
    },

    isAdmin: {
      type: Boolean,
      default: false,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee", // admin
    },

    otp: { type: Number, default: null },
    otpExpiresAt: { type: Date, default: null },
    lastLogin: { type: Date },
  },
  { timestamps: true }
);

employeeSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  // Hash password before saving
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

export default mongoose.model("Employee", employeeSchema);
