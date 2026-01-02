import { body } from "express-validator";
import moment from "moment";

export const updateProfileValidation = [
  body().custom((value, { req }) => {
    const payload = req.body || {};
    const hasUpdates = ["name", "firstName", "lastName", "email", "phoneNumber", "profilePic", "dateofBirth"]
      .some((field) => payload[field] !== undefined && payload[field] !== null && payload[field] !== "");

    if (!hasUpdates) {
      throw new Error("Provide at least one field to update");
    }
    return true;
  }),

  body("name")
    .optional()
    .isString()
    .withMessage("Name must be a string")
    .trim()
    .isLength({ min: 2 })
    .withMessage("Name must be at least 2 characters long"),

  body("firstName")
    .optional()
    .isString()
    .withMessage("First name must be a string")
    .trim()
    .isLength({ min: 2 })
    .withMessage("First name must be at least 2 characters long"),

  body("lastName")
    .optional()
    .isString()
    .withMessage("Last name must be a string")
    .trim()
    .isLength({ min: 2 })
    .withMessage("Last name must be at least 2 characters long"),

  body("email")
    .optional()
    .isEmail()
    .withMessage("Invalid email format")
    .normalizeEmail(),

  body("phoneNumber")
    .optional()
    .isMobilePhone("any")
    .withMessage("Invalid phone number")
    .trim(),

  body("profilePic")
    .optional()
    .isString()
    .withMessage("Profile picture must be a string")
    .trim(),

  body("dateofBirth")
    .optional()
    .custom((value) => {
      // Check if date is valid using moment
      if (!moment(value, "YYYY-MM-DD", true).isValid()) {
        throw new Error("Invalid date format. Use YYYY-MM-DD");
      }
      return true;
    }),
];

export const addCustomerValidation = [
  body("firstName")
    .notEmpty()
    .withMessage("First name is required")
    .isString()
    .withMessage("First name must be a string")
    .trim()
    .isLength({ min: 2 })
    .withMessage("First name must be at least 2 characters long"),

  body("lastName")
    .notEmpty()
    .withMessage("Last name is required")
    .isString()
    .withMessage("Last name must be a string")
    .trim()
    .isLength({ min: 2 })
    .withMessage("Last name must be at least 2 characters long"),

  body("email")
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Invalid email format")
    .normalizeEmail(),

  body("phoneNumber")
    .notEmpty()
    .withMessage("Phone number is required")
    .isMobilePhone("any")
    .withMessage("Invalid phone number")
    .trim(),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),

  body("profilePic")
    .optional()
    .isString()
    .withMessage("Profile picture must be a string")
    .trim(),

  body("dateofBirth")
    .optional()
    .custom((value) => {
      if (!moment(value, "YYYY-MM-DD", true).isValid()) {
        throw new Error("Invalid date format. Use YYYY-MM-DD");
      }
      return true;
    }),
];