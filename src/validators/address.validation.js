import { body } from "express-validator";

export const latlongValidation = [
  // Custom validator for location that supports both 'long' and 'lng'
  body("location")
    .exists({ checkFalsy: true })
    .withMessage("Location is required")
    .custom((value) => {
      if (!value || typeof value !== "object") {
        throw new Error("Location must be an object");
      }

      // Validate latitude
      if (value.lat == null) {
        throw new Error("Latitude is required");
      }
      const lat = parseFloat(value.lat);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        throw new Error("Latitude must be a valid number between -90 and 90");
      }

      // Support both 'long' and 'lng' field names
      const longitude = value.lng ?? value.long;
      if (longitude == null) {
        throw new Error("Longitude is required (use 'long' or 'lng')");
      }
      const lng = parseFloat(longitude);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        throw new Error("Longitude must be a valid number between -180 and 180");
      }

      return true;
    }),

  body("label").notEmpty().withMessage("Label is required"),
  body("street").notEmpty().withMessage("Street is required"),
  body("city").notEmpty().withMessage("City is required"),
  body("state").notEmpty().withMessage("State is required"),
  body("country").notEmpty().withMessage("Country is required"),
  body("zip").notEmpty().withMessage("Zip code is required")
];
