import bcrypt from "bcryptjs";
import User from "../models/user.js";
import StockAlert from "../models/stock.js";
import Bill from "../models/bill.js";
import SaleReturn from "../models/saleReturn.js";
import CustomerRatingSetting from "../models/customerRatingSetting.js";
import responseHandler from "../utils/responseHandler.js";
import { USER_ROLES } from "../constants/auth.js";

export const getAllCustomers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const { search } = req.query;

    const query = { role: USER_ROLES.CUSTOMER };

    if (search) {
      const searchRegex = new RegExp(search.trim(), "i");
      query.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { phoneNumber: searchRegex },
        { customerCode: searchRegex },
      ];
    }

    const [customers, totalCustomers] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .select("-password -otp -otpExpiresAt"),
      User.countDocuments(query),
    ]);

    // Ensure customerCode exists for all fetched customers
    await Promise.all(
      customers.map(async (customer) => {
        if (!customer.customerCode) {
          await customer.save();
        }
      })
    );

    // Calculate total bill amount for each customer
    const customerIds = customers.map((c) => c._id);
    const billStats = await Bill.aggregate([
      { $match: { customerId: { $in: customerIds } } },
      { $group: { _id: "$customerId", totalAmount: { $sum: "$netAmount" } } },
    ]);

    const billMap = {};
    billStats.forEach((stat) => {
      billMap[stat._id.toString()] = stat.totalAmount;
    });

    const customersWithBillAmount = customers.map((customer) => {
      const custObj = customer.toObject();
      const billTotal = billMap[customer._id.toString()] || 0;
      custObj.totalBillAmount = Number(billTotal.toFixed(2));
      return custObj;
    });

    const pagination = {
      page,
      limit,
      total: totalCustomers,
      totalPages: Math.max(1, Math.ceil(totalCustomers / limit)),
    };

    return res.json(
      responseHandler.success(
        {
          customers: customersWithBillAmount,
          pagination,
        },
        "Customers fetched successfully"
      )
    );
  } catch (error) {
    return res.status(500).json(responseHandler.error(error.message));
  }
};

export const updateCustomerStatus = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { status } = req.body;

    if (typeof status !== "boolean") {
      return res
        .status(400)
        .json(responseHandler.error("Status must be a boolean value"));
    }

    const customer = await User.findOneAndUpdate(
      { _id: customerId, role: USER_ROLES.CUSTOMER },
      { isBlocked: status },
      { new: true }
    ).select("-password -otp -otpExpiresAt");

    if (!customer) {
      return res
        .status(404)
        .json(responseHandler.error("Customer not found"));
    }

    const message = status
      ? "Customer blocked successfully"
      : "Customer unblocked successfully";

    return res.json(
      responseHandler.success(
        {
          customer,
        },
        message
      )
    );
  } catch (error) {
    return res.status(500).json(responseHandler.error(error.message));
  }
};

export const updateCustomerRating = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { rating } = req.body;

    const settings = await StockAlert.findOne();
    const maxRatingAllowed = settings?.maxRating || 5;

    if (rating === undefined || typeof rating !== "number" || rating < 0 || rating > maxRatingAllowed) {
      return res
        .status(400)
        .json(responseHandler.error(`Rating must be a number between 0 and ${maxRatingAllowed}`));
    }

    const customer = await User.findOneAndUpdate(
      { _id: customerId, role: USER_ROLES.CUSTOMER },
      { rating },
      { new: true }
    ).select("-password -otp -otpExpiresAt");

    if (!customer) {
      return res.status(404).json(responseHandler.error("Customer not found"));
    }

    return res.json(
      responseHandler.success(
        { customer },
        "Customer rating updated successfully"
      )
    );
  } catch (error) {
    return res.status(500).json(responseHandler.error(error.message));
  }
};

export const getCustomerRatingSettings = async (req, res) => {
  try {
    let settings = await CustomerRatingSetting.findOne();

    // If no settings exist, return default values to prevent frontend issues
    if (!settings) {
      settings = {
        star1Min: 0,
        star1Max: 0,
        star2Min: 0,
        star2Max: 0,
        star3Min: 0,
        star3Max: 0,
        star4Min: 0,
        star4Max: 0,
        star5Min: 0,
        star5Max: 0,
      };
    }

    return res.json(
      responseHandler.success(
        settings,
        "Customer rating settings fetched successfully"
      )
    );
  } catch (error) {
    return res.status(500).json(responseHandler.error(error.message));
  }
};

export const saveCustomerRatingSettings = async (req, res) => {
  try {
    const {
      star1Min,
      star1Max,
      star2Min,
      star2Max,
      star3Min,
      star3Max,
      star4Min,
      star4Max,
      star5Min,
      star5Max,
    } = req.body;

    const settings = await CustomerRatingSetting.findOneAndUpdate(
      {},
      {
        star1Min,
        star1Max,
        star2Min,
        star2Max,
        star3Min,
        star3Max,
        star4Min,
        star4Max,
        star5Min,
        star5Max,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );

    return res.json(
      responseHandler.success(
        settings,
        "Customer rating settings saved successfully"
      )
    );
  } catch (error) {
    return res.status(500).json(responseHandler.error(error.message));
  }
};

export const deleteCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;

    const customer = await User.findOneAndDelete({
      _id: customerId,
      role: USER_ROLES.CUSTOMER,
    });

    if (!customer) {
      return res
        .status(404)
        .json(responseHandler.error("Customer not found"));
    }

    // Delete associated bills and sale returns
    await Promise.all([
      Bill.deleteMany({ customerId }),
      SaleReturn.deleteMany({ customerId }),
    ]);

    return res.json(
      responseHandler.success(
        {
          customerId,
        },
        "Customer and associated data deleted successfully"
      )
    );
  } catch (error) {
    return res.status(500).json(responseHandler.error(error.message));
  }
};

export const getCustomersByDateRange = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const { startDate, endDate, sortBy = "createdAt", sortOrder = "desc" } = req.query;

    const query = { role: USER_ROLES.CUSTOMER };

    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return res
            .status(400)
            .json(responseHandler.error("Invalid start date format. Use YYYY-MM-DD or ISO 8601 format"));
        }
        if (start > today) {
          return res.status(400).json(responseHandler.error("Future dates are not allowed"));
        }
        // Set to start of day
        start.setHours(0, 0, 0, 0);
        query.createdAt.$gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return res
            .status(400)
            .json(responseHandler.error("Invalid end date format. Use YYYY-MM-DD or ISO 8601 format"));
        }
        // Set to end of day
        // Set to end of day
        end.setHours(23, 59, 59, 999);
        if (end > today) {
          return res.status(400).json(responseHandler.error("Future dates are not allowed"));
        }
        query.createdAt.$lte = end;
      }

      if (query.createdAt.$gte && query.createdAt.$lte && query.createdAt.$lte < query.createdAt.$gte) {
        return res.status(400).json(responseHandler.error("End date cannot be prior to start date"));
      }
    } else {
      return res
        .status(400)
        .json(responseHandler.error("Please provide at least startDate or endDate"));
    }

    // Sort options
    const sortOptions = {};
    const validSortFields = ["createdAt", "firstName", "lastName", "email", "rating"];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    sortOptions[sortField] = sortOrder === "asc" ? 1 : -1;

    const [customers, totalCustomers] = await Promise.all([
      User.find(query)
        .sort(sortOptions)
        .skip(offset)
        .limit(limit)
        .select("-password -otp -otpExpiresAt"),
      User.countDocuments(query),
    ]);

    // Calculate total bill amount for each customer
    const customerIds = customers.map((c) => c._id);
    const billStats = await Bill.aggregate([
      { $match: { customerId: { $in: customerIds } } },
      { $group: { _id: "$customerId", totalAmount: { $sum: "$netAmount" } } },
    ]);

    const billMap = {};
    billStats.forEach((stat) => {
      billMap[stat._id.toString()] = stat.totalAmount;
    });

    const customersWithBillAmount = customers.map((customer) => {
      const custObj = customer.toObject();
      const billTotal = billMap[customer._id.toString()] || 0;
      custObj.totalBillAmount = Number(billTotal.toFixed(2));
      return custObj;
    });

    const pagination = {
      page,
      limit,
      total: totalCustomers,
      totalPages: Math.max(1, Math.ceil(totalCustomers / limit)),
    };

    // Calculate date range statistics
    const dateStats = await User.aggregate([
      { $match: { role: USER_ROLES.CUSTOMER } },
      {
        $group: {
          _id: null,
          earliestCustomer: { $min: "$createdAt" },
          latestCustomer: { $max: "$createdAt" },
          totalCustomers: { $sum: 1 },
        },
      },
    ]);

    const stats = dateStats[0] || {
      earliestCustomer: null,
      latestCustomer: null,
      totalCustomers: 0,
    };

    return res.json(
      responseHandler.success(
        {
          customers: customersWithBillAmount,
          pagination,
          filters: {
            startDate: startDate || null,
            endDate: endDate || null,
            sortBy: sortField,
            sortOrder,
          },
          statistics: {
            earliestCustomer: stats.earliestCustomer || null,
            latestCustomer: stats.latestCustomer || null,
            totalCustomers: stats.totalCustomers || 0,
            customersInRange: totalCustomers,
          },
        },
        "Customers filtered by date range retrieved successfully"
      )
    );
  } catch (error) {
    return res.status(500).json(responseHandler.error(error.message));
  }
};

export const getCustomersByRating = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    const { rating, minRating, maxRating, sortBy = "rating", sortOrder = "desc" } = req.query;

    const settings = await StockAlert.findOne();
    const maxRatingAllowed = settings?.maxRating || 5;

    const query = { role: USER_ROLES.CUSTOMER };

    // Filter by exact rating
    if (rating !== undefined && rating !== null && rating !== "") {
      const ratingNum = parseFloat(rating);
      if (!isNaN(ratingNum) && ratingNum >= 0 && ratingNum <= maxRatingAllowed) {
        query.rating = ratingNum;
      }
    } else {
      // Filter by rating range
      if (minRating !== undefined && minRating !== null && minRating !== "") {
        const min = parseFloat(minRating);
        if (!isNaN(min) && min >= 0 && min <= maxRatingAllowed) {
          query.rating = query.rating || {};
          query.rating.$gte = min;
        }
      }

      if (maxRating !== undefined && maxRating !== null && maxRating !== "") {
        const max = parseFloat(maxRating);
        if (!isNaN(max) && max >= 0 && max <= maxRatingAllowed) {
          query.rating = query.rating || {};
          query.rating.$lte = max;
        }
      }
    }

    // Sort options
    const sortOptions = {};
    const validSortFields = ["rating", "createdAt", "firstName", "lastName"];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "rating";
    sortOptions[sortField] = sortOrder === "asc" ? 1 : -1;

    const [customers, totalCustomers] = await Promise.all([
      User.find(query)
        .sort(sortOptions)
        .skip(offset)
        .limit(limit)
        .select("-password -otp -otpExpiresAt"),
      User.countDocuments(query),
    ]);

    // Calculate total bill amount for each customer
    const customerIds = customers.map((c) => c._id);
    const billStats = await Bill.aggregate([
      { $match: { customerId: { $in: customerIds } } },
      { $group: { _id: "$customerId", totalAmount: { $sum: "$netAmount" } } },
    ]);

    const billMap = {};
    billStats.forEach((stat) => {
      billMap[stat._id.toString()] = stat.totalAmount;
    });

    const customersWithBillAmount = customers.map((customer) => {
      const custObj = customer.toObject();
      const billTotal = billMap[customer._id.toString()] || 0;
      custObj.totalBillAmount = Number(billTotal.toFixed(2));
      return custObj;
    });

    const pagination = {
      page,
      limit,
      total: totalCustomers,
      totalPages: Math.max(1, Math.ceil(totalCustomers / limit)),
    };

    // Calculate rating statistics
    const ratingStats = await User.aggregate([
      { $match: { role: USER_ROLES.CUSTOMER } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          minRating: { $min: "$rating" },
          maxRating: { $max: "$rating" },
          totalCustomers: { $sum: 1 },
        },
      },
    ]);

    const stats = ratingStats[0] || {
      averageRating: null,
      minRating: null,
      maxRating: null,
      totalCustomers: 0,
    };

    // Safely handle null values in statistics
    const averageRating = stats.averageRating !== null && stats.averageRating !== undefined
      ? parseFloat(stats.averageRating.toFixed(2))
      : 0;

    const minRatingValue = stats.minRating !== null && stats.minRating !== undefined
      ? stats.minRating
      : 0;

    const maxRatingValue = stats.maxRating !== null && stats.maxRating !== undefined
      ? stats.maxRating
      : 0;

    return res.json(
      responseHandler.success(
        {
          customers: customersWithBillAmount,
          pagination,
          filters: {
            rating: rating !== undefined && rating !== "" ? parseFloat(rating) : null,
            minRating: minRating !== undefined && minRating !== "" ? parseFloat(minRating) : null,
            maxRating: maxRating !== undefined && maxRating !== "" ? parseFloat(maxRating) : null,
            sortBy: sortField,
            sortOrder,
          },
          statistics: {
            averageRating,
            minRating: minRatingValue,
            maxRating: maxRatingValue,
            totalCustomers: stats.totalCustomers || 0,
          },
        },
        "Customers filtered by rating retrieved successfully"
      )
    );
  } catch (error) {
    return res.status(500).json(responseHandler.error(error.message));
  }
};

export const addCustomer = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      password,
      profilePic,
      dateofBirth,
      gender,
    } = req.body;

    // Sanitize inputs: Convert empty strings or whitespace to undefined
    const cleanEmail = email?.trim() || undefined;
    const cleanPhone = phoneNumber?.trim() || undefined;

    // Check if phone number already exists
    if (cleanPhone) {
      const existingPhoneUser = await User.findOne({ phoneNumber: cleanPhone });
      if (existingPhoneUser) {
        return res
          .status(409)
          .json(responseHandler.error("Phone number already exists"));
      }
    }

    // Create customer
    const customerData = {
  firstName: firstName || "N/A",
  lastName: lastName,
  email: cleanEmail,
  password: password,
  profilePic: profilePic || "N/A",
  dateofBirth: dateofBirth ? new Date(dateofBirth) : null,
  gender: gender || "N/A",
  role: USER_ROLES.CUSTOMER,
  isPhoneVerified: false,
  isEmailVerified: false,
  isNewUser: true,
  isBlocked: false,
};

// ✅ add phoneNumber only if provided
if (cleanPhone) {
  customerData.phoneNumber = cleanPhone;
}

const customer = await User.create(customerData);


    // Return customer without password
    const customerResponse = customer.toObject();
    delete customerResponse.password;
    delete customerResponse.otp;
    delete customerResponse.otpExpiresAt;
    delete customerResponse.resetPasswordToken;
    delete customerResponse.resetPasswordExpiresAt;

    // Manually add customerId to the response object for frontend clarity
    customerResponse.customerId = customerResponse._id;
    customerResponse.totalBillAmount = 0;

    return res.status(201).json(
      responseHandler.success(
        {
          customer: customerResponse,
        },
        "Customer added successfully"
      )
    );
  } catch (error) {
    // Handle MongoDB duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res
        .status(409)
        .json(
          responseHandler.error(
            `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`
          )
        );
    }
    return res.status(500).json(responseHandler.error(error.message));
  }
};
