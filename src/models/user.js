import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    // 🔑 CUSTOMER CODE (CUST-001)
    customerCode: {
      type: String,
      unique: true,
      index: true,
    },

    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    profilePic: { type: String, default: "" },
    dateofBirth: { type: Date, default: null },
    email: { type: String, unique: true, sparse: true },
    phoneNumber: { type: String, unique: true, required: true },
    password: { type: String, default: "" },
    otp: { type: Number, default: null },
    otpExpiresAt: { type: Date, default: null },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpiresAt: { type: Date, default: null },
    role: { type: String, enum: ["customer"], default: "customer" },
    isPhoneVerified: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    isNewUser: { type: Boolean, default: true },
    isBlocked: { type: Boolean, default: false },
    lastLogin: { type: Date },
    rating: { type: Number, default: 0, min: 0, max: 5 },
  },
  { timestamps: true }
);

// 🔐 PASSWORD HASH
userSchema.pre("save", async function (next) {
  if (this.isModified("password") && this.password) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// 🔢 AUTO-GENERATE CUST-001
userSchema.pre("save", async function (next) {
  if (this.customerCode) return next();

  const lastCustomer = await mongoose
    .model("User")
    .findOne({ customerCode: { $regex: /^CUST-\d+$/ } })
    .sort({ createdAt: -1 });

  let nextNumber = 1;
  if (lastCustomer?.customerCode) {
    const lastNum = parseInt(lastCustomer.customerCode.split("-")[1], 10);
    if (!isNaN(lastNum)) nextNumber = lastNum + 1;
  }

  this.customerCode = `CUST-${String(nextNumber).padStart(3, "0")}`;
  next();
});

const User = mongoose.model("User", userSchema);
export default User;
