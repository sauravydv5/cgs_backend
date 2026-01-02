import Admin from "../models/admin.js";
import bcrypt from "bcryptjs";
import responseHandler from "../utils/responseHandler.js";
import jwt from "jsonwebtoken";

const generateOtp = () => Number(process.env.OTP || 1234);
/**
 * Generates and saves an OTP for an admin.
 * @param {object} admin - The Mongoose admin document.
 * @returns {number} The generated OTP.
 */
const generateAndSaveAdminOtp = async (admin) => {
  const otp = parseInt(process.env.OTP || 1234); // Using a static OTP from env for now
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5-minute expiry

  admin.otp = otp;
  admin.otpExpiresAt = expiresAt;
  await admin.save();

  console.log(`OTP for admin ${admin.email}: ${otp}`);
  return otp;
};

console.log("🔥 ADMIN LOGIN API HIT 🔥");
export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json(responseHandler.error("Email and password are required"));
    }

    const admin = await Admin.findOne({ email });

    if (!admin) {
      return res.status(404).json(responseHandler.error("Admin not found"));
    }

    if (admin.isBlocked) {
      return res.status(403).json(responseHandler.error("Your account is blocked. Please contact support."));
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json(responseHandler.error("Invalid credentials"));
    }

    const otp = await generateAndSaveAdminOtp(admin);

    return res.json(
      responseHandler.success({ otp }, "OTP sent successfully")
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

export const verifyAdminOtp = async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
      return res
        .status(400)
        .json(responseHandler.error("Phone number and OTP are required"));
    }

    const admin = await Admin.findOne({
      phoneNumber,
      otp: Number(otp),
      otpExpiresAt: { $gt: new Date() },
    });

    if (!admin) {
      return res.status(400).json(responseHandler.error("Invalid OTP"));
    }

    admin.otp = null;
    admin.otpExpiresAt = null;
    admin.lastLogin = new Date();
    await admin.save();

    const token = jwt.sign(
      { id: admin._id, role: "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.json(
      responseHandler.success(
        {
          user: {
            _id: admin._id,
            firstName: admin.firstName,
            lastName: admin.lastName,
            email: admin.email,
            phoneNumber: admin.phoneNumber,
            role: admin.role,
          },
          token,
        },
        "Admin login successful"
      )
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};
