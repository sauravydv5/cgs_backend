import Admin from "../models/admin.js";
import bcrypt from "bcryptjs";
import responseHandler from "../utils/responseHandler.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";

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

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json(responseHandler.error("Email is required"));
    }

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json(responseHandler.error("Admin with this email does not exist"));
    }

    // Generate a plain token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Hash the token for database storage
    admin.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Set an expiry time for the token (e.g., 15 minutes)
    admin.resetPasswordExpiresAt = Date.now() + 15 * 60 * 1000;

    await admin.save();

    // In a real app, you'd send an email with a link like:
    // `https://your-frontend.com/admin/reset-password/${resetToken}`
    console.log(`Password reset token for ${admin.email}: ${resetToken}`);

    return res.json(responseHandler.success(
      null,
      "A password reset link has been sent to your email address."
    ));

  } catch (err) {
    console.error(err);
    return res.status(500).json(responseHandler.error("An error occurred while processing your request."));
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json(responseHandler.error("Password is required"));
    }

    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const admin = await Admin.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpiresAt: { $gt: Date.now() },
    });

    if (!admin) {
      return res.status(400).json(responseHandler.error("Password reset token is invalid or has expired."));
    }

    admin.password = password;
    admin.resetPasswordToken = undefined;
    admin.resetPasswordExpiresAt = undefined;

    await admin.save();

    return res.json(responseHandler.success(null, "Password has been reset successfully."));

  } catch (err) {
    console.error(err);
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
            dateofBirth: admin.dateofBirth,
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

export const resendOtp = async (req, res) => {
  try {
    const { email, phoneNumber } = req.body;

    if (!email && !phoneNumber) {
      return res
        .status(400)
        .json(responseHandler.error("Email or Phone number is required"));
    }

    let query = {};
    if (email) query.email = email;
    else if (phoneNumber) query.phoneNumber = phoneNumber;

    const admin = await Admin.findOne(query);

    if (!admin) {
      return res.status(404).json(responseHandler.error("Admin not found"));
    }

    if (admin.isBlocked) {
      return res.status(403).json(responseHandler.error("Your account is blocked. Please contact support."));
    }

    const otp = await generateAndSaveAdminOtp(admin);

    return res.json(responseHandler.success({ otp }, "OTP resent successfully"));
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

export const getAdminProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id).select("-password -otp -otpExpiresAt -resetPasswordToken -resetPasswordExpiresAt");

    if (!admin) {
      return res.status(404).json(responseHandler.error("Admin not found"));
    }

    return res.json(responseHandler.success(admin, "Admin profile retrieved successfully"));
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

export const updateAdminProfile = async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber, dateofBirth } = req.body;
    const adminId = req.user._id;

    // Check if email or phone is already taken by another admin
    if (email || phoneNumber) {
      const query = { _id: { $ne: adminId }, $or: [] };
      if (email) query.$or.push({ email });
      if (phoneNumber) query.$or.push({ phoneNumber });

      if (query.$or.length > 0) {
        const existingAdmin = await Admin.findOne(query);
        if (existingAdmin) {
          return res
            .status(400)
            .json(responseHandler.error("Email or Phone number already in use"));
        }
      }
    }

    const updates = {};
    if (firstName) updates.firstName = firstName;
    if (lastName) updates.lastName = lastName;
    if (email) updates.email = email;
    if (phoneNumber) updates.phoneNumber = phoneNumber;
    if (dateofBirth) updates.dateofBirth = dateofBirth;

    const admin = await Admin.findByIdAndUpdate(adminId, updates, {
      new: true,
    }).select("-password -otp -otpExpiresAt -resetPasswordToken -resetPasswordExpiresAt");

    return res.json(
      responseHandler.success(admin, "Admin profile updated successfully")
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};
