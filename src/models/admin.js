import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const adminSchema = new mongoose.Schema(
  {
    firstName: String,
    lastName: String,

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },

    phoneNumber: {
      type: String,
      unique: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      default: "admin",
    },

    isBlocked: {
      type: Boolean,
      default: false,
    },

    otp: { type: Number, default: null },
    otpExpiresAt: { type: Date, default: null },

    lastLogin: Date,
  },
  { timestamps: true }
);

adminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await bcrypt.hash(this.password, 10);
  next();
});

export default mongoose.model("Admin", adminSchema);
