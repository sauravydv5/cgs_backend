import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import responseHandler from "../utils/responseHandler.js";

/**
 * Generates and saves an OTP for a user.
 * @param {object} user - The Mongoose user document.
 * @returns {number} The generated OTP.
 */
const generateAndSaveOtp = async (user) => {
  const otp = parseInt(process.env.OTP); // Using a static OTP from env for now
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5-minute expiry

  user.otp = otp;
  user.otpExpiresAt = expiresAt;
  await user.save();

  console.log(`OTP for ${user.phoneNumber}: ${otp}`);
  return otp;
};

export const sendOtp = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber)
      return res
        .status(400)
        .json(responseHandler.error("Phone number is required"));

    let user = await User.findOne({
      phoneNumber: {
        $regex: new RegExp(`${phoneNumber}$`, 'i')
      }
    });

    if (!user) user = await User.create({ phoneNumber });

    const otp = await generateAndSaveOtp(user);

    return res.json(
      responseHandler.success(
        { otp, isNewUser: user.isNewUser },
        "OTP sent successfully"
      )
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp)
      return res
        .status(400)
        .json(responseHandler.error("Phone number and OTP are required"));

    const user = await User.findOne({
      phoneNumber: {
        $regex: new RegExp(`${phoneNumber}$`, 'i')
      },
      otp: Number(otp), // Check for OTP directly in the query
      otpExpiresAt: { $gt: new Date() } // Check for expiration in the query
    });

    // If no user is found with the correct, non-expired OTP, it's invalid.
    if (!user)
      return res.status(400).json(responseHandler.error("Invalid OTP"));

    user.otp = undefined;
    user.otpExpiresAt = undefined;
    user.isPhoneVerified = true;
    user.isNew = false;
    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.json(
      responseHandler.success(
        {
          user: {
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            profilePic: user.profilePic,
            role: user.role,
            isNewUser: user.isNewUser,
          },
          token,
        },
        "OTP verified successfully"
      )
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};