import Employee from "../models/employee.js";
import Role from "../models/role.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import responseHandler from "../utils/responseHandler.js";

export const createEmployee = async (req, res) => {
  const {
    firstName,
    lastName,
    email,
    phoneNumber,
    password,
    role,
    zone,
    status,
  } = req.body;

  let roleData;
  if (mongoose.Types.ObjectId.isValid(role)) {
    roleData = await Role.findById(role);
  } else {
    roleData = await Role.findOne({ roleName: role });
  }

  if (!roleData) return res.status(400).json({ message: "Invalid role" });

  const employee = await Employee.create({
    firstName,
    lastName,
    email,
    phoneNumber,
    password,
    role: roleData._id, // Ensure we save the ID
    zone,
    status,
    createdBy: req.employee._id,
  });

  await employee.populate("role", "roleName permissions");

  res.status(201).json(employee);
};

export const getAllEmployees = async (req, res) => {
  const employees = await Employee.find()
    .populate("role", "roleName permissions")
    .select("-password");
  res.json(employees);
};

export const getEmployeeById = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid Employee ID" });
  }

  const employee = await Employee.findById(req.params.id)
    .populate("role", "roleName permissions")
    .select("-password");

  if (!employee)
    return res.status(404).json({ message: "Employee not found" });

  res.json(employee);
};

export const updateEmployee = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid Employee ID" });
  }

  // ✅ If role is being updated, sync permissions automatically
  if (req.body.role) {
    let roleData;
    if (mongoose.Types.ObjectId.isValid(req.body.role)) {
      roleData = await Role.findById(req.body.role);
    } else {
      roleData = await Role.findOne({ roleName: req.body.role });
    }

    if (!roleData) return res.status(400).json({ message: "Invalid role" });

    req.body.role = roleData._id;
  }

  // Find the employee first to trigger pre-save hooks for password hashing
  const employee = await Employee.findById(req.params.id);

  if (!employee)
    return res.status(404).json({ message: "Employee not found" });

  // Update fields from request body
  Object.assign(employee, req.body);

  // If a new password is provided, it will be hashed by the pre-save hook
  if (req.body.password) {
    employee.password = req.body.password;
  }

  const updatedEmployee = await employee.save();

  // Manually populate after saving to include role details in the response
  await updatedEmployee.populate("role", "roleName permissions");

  // Exclude password from the response object
  const responseEmployee = updatedEmployee.toObject();
  delete responseEmployee.password;

  res.json(responseEmployee);
};

export const changeEmployeeRole = async (req, res) => {
  const { role } = req.body;

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: "Invalid Employee ID" });
  }

  // Check if role is an ID or a Name
  let roleData;
  if (mongoose.Types.ObjectId.isValid(role)) {
    roleData = await Role.findById(role);
  } else {
    roleData = await Role.findOne({ roleName: role });
  }

  if (!roleData) return res.status(400).json({ message: "Invalid role" });

  const employee = await Employee.findById(req.params.id);
  if (!employee)
    return res.status(404).json({ message: "Employee not found" });

  employee.role = roleData._id;

  await employee.save();
  await employee.populate("role", "roleName permissions"); // Populate role details in response
  res.json(employee);
};

/* ================= EMPLOYEE AUTHENTICATION ================= */

const generateAndSaveEmployeeOtp = async (employee) => {
  const otp = parseInt(process.env.OTP || 1234);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

  employee.otp = otp;
  employee.otpExpiresAt = expiresAt;
  await employee.save();

  console.log(`OTP for Employee ${employee.email}: ${otp}`);
  return otp;
};

export const employeeLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json(responseHandler.error("Email and password are required"));
    }

    const employee = await Employee.findOne({ email });
    if (!employee) {
      return res.status(404).json(responseHandler.error("Employee not found"));
    }

    if (employee.status === false) {
      return res.status(403).json(responseHandler.error("Your account is inactive. Contact Admin."));
    }

    // Check for plain text match first (legacy support), then hashed match
    let isMatch = password === employee.password;
    if (!isMatch) {
      isMatch = await bcrypt.compare(password, employee.password).catch(() => false);
    }

    if (!isMatch) {
      return res.status(401).json(responseHandler.error("Invalid credentials"));
    }

    const otp = await generateAndSaveEmployeeOtp(employee);

    return res.json(responseHandler.success({ otp }, "OTP sent successfully"));
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

export const verifyEmployeeOtp = async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
      return res.status(400).json(responseHandler.error("Phone number and OTP are required"));
    }

    const employee = await Employee.findOne({
      phoneNumber,
      otp: Number(otp),
      otpExpiresAt: { $gt: new Date() },
    });


    if (!employee) {
      return res.status(400).json(responseHandler.error("Invalid OTP or expired"));
    }

    // Clear OTP
    employee.otp = null;
    employee.otpExpiresAt = null;
    employee.lastLogin = new Date();
    await employee.save();

    // Populate role to get permissions for the login response
    await employee.populate('role', 'permissions');

    // Generate Token
    const token = jwt.sign(
      { id: employee._id, role: "employee" },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.json(
      responseHandler.success(
        {
          user: {
            _id: employee._id,
            firstName: employee.firstName,
            lastName: employee.lastName,
            email: employee.email,
            phoneNumber: employee.phoneNumber,
            role: "employee",
            permissions: employee.role ? employee.role.permissions : [], // Send permissions for frontend access control
          },
          token,
        },
        "Employee login successful"
      )
    );
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};

export const getEmployeeProfile = async (req, res) => {
  try {
    const employee = await Employee.findById(req.employee._id)
      .populate("role", "roleName permissions")
      .select("-password");

    return res.json(responseHandler.success(employee, "Profile retrieved successfully"));
  } catch (err) {
    return res.status(500).json(responseHandler.error(err.message));
  }
};
