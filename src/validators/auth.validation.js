import { body } from "express-validator";

export const loginAdminValidation = [
  body("email").notEmpty().isEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
];

export const adminForgotPasswordValidation = [
  body("email").notEmpty().isEmail().withMessage("Valid email is required"),
];
