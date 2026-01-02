import { validationResult } from "express-validator";
import responseHandler from "../utils/responseHandler.js";

export default function requestValidator(req, res, next) {
  const result = validationResult(req);

  if (!result.isEmpty()) {
    // Extract all error messages (or just the first one if you prefer)
    const messages = result.array().map(err => err.msg);
    
    // If you only want the first error message:
    // const errorMessage = result.array()[0].msg;

    return res
      .status(400)
      .json(responseHandler.error(messages.join(", ")));
  }

  next();
}
