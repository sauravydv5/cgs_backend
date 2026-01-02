import { USER_ROLES } from "../constants/auth.js";
import User from "../models/user.js";
import responseHandler from "../utils/responseHandler.js";
import moment from "moment";

// Get user profile (private)
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select("-__v -password")
      .lean();

    if (!user)
      return res.status(404).json(responseHandler.error("User not found"));

    user.name = [user.firstName, user.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

    return res.json(
      responseHandler.success(user, "User profile retrieved successfully")
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

// Update user profile (private)
export const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      firstName,
      lastName,
      email,
      phoneNumber,
      profilePic,
      dateofBirth,
    } = req.body;

    const userRole = req.user.role;
    if (userRole === USER_ROLES.ADMIN) {
      const user = await User.findOne({
        _id: { $ne: userId },
        email: email,
        role: { $ne: USER_ROLES.ADMIN },
      });
      if (user) {
        return res.status(404).json(responseHandler.error("User Alredy Exist"));
      }
    } else if (userRole === USER_ROLES.CUSTOMER) {
      const user = await User.findOne({ _id: { $ne: userId }, email: email });
      if (user) {
        return res.status(404).json(responseHandler.error("User Alredy Exist"));
      }
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (email !== undefined) updates.email = email;
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
    // Only update profilePic if it's a non-empty string.
    // This prevents it from being set to null or an empty string unintentionally.
    if (profilePic) {
      updates.profilePic = profilePic;
    }
    if (dateofBirth !== undefined) updates.dateofBirth = dateofBirth;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true }
    ).select("-password -__v");

    if (!user) {
      return res.status(404).json(responseHandler.error("User not found"));
    }

    return res.json(responseHandler.success(user, "Profile updated successfully"));
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

// Update admin profile (private)
export const updateAdminProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      name,
      firstName,
      lastName,
      email,
      phoneNumber,
      profilePic,
      dateofBirth,
    } = req.body;

    const userRole = req.user.role;
    if (userRole !== USER_ROLES.ADMIN) {
      return res.status(403).json(responseHandler.error("Access denied. Admin only."));
    }

    const updates = {};
    const fields = {
      name,
      firstName,
      lastName,
      email,
      phoneNumber,
      dateofBirth,
    };

    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined) {
        updates[key] = value;
      }
    });

    // Handle profile picture update separately to avoid setting it to null
    if (req.file) {
      updates.profilePic = `/uploads/${req.file.filename}`;
    } else if (profilePic) {
      updates.profilePic = profilePic;
    }

    if (updates.email) {
      const existingEmailUser = await User.findOne({
        _id: { $ne: userId },
        email: updates.email,
      });
      if (existingEmailUser) {
        return res
          .status(409)
          .json(responseHandler.error("Email already in use by another user."));
      }
    }

    if (updates.phoneNumber) {
      const existingPhoneUser = await User.findOne({
        _id: { $ne: userId },
        phoneNumber: updates.phoneNumber,
      });
      if (existingPhoneUser) {
        return res
          .status(409)
          .json(responseHandler.error("Phone number already in use by another user."));
      }
    }

    if (updates.dateofBirth) {
      updates.dateofBirth = moment(updates.dateofBirth, "YYYY-MM-DD").toDate();
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true }
    ).select("-password -__v");

    if (!user) {
      return res.status(404).json(responseHandler.error("User not found"));
    }

    return res.json(responseHandler.success(user, "Profile updated successfully"));
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

// Get admin profile (private, admin only)
export const getAdminProfile = async (req, res) => {
  try {
    const userRole = req.user.role;
    if (userRole !== USER_ROLES.ADMIN) {
      return res.status(403).json(responseHandler.error("Access denied. Admin only."));
    }

    const user = await User.findById(req.user.id)
      .select("-__v -password")
      .lean();

    if (!user)
      return res.status(404).json(responseHandler.error("User not found"));

    user.name = [user.firstName, user.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

    return res.json(
      responseHandler.success(user, "Admin profile retrieved successfully")
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};