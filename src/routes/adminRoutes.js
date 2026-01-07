import express from "express";
import { adminLogin, verifyAdminOtp, forgotPassword, resetPassword, resendOtp, getAdminProfile, updateAdminProfile } from "../controllers/adminController.js";
import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/login", adminLogin);
router.post("/otp/verify", verifyAdminOtp);
router.post("/otp/resend", resendOtp);
router.post("/forget-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.get("/profile", protect, getAdminProfile);
router.put("/profile", protect, updateAdminProfile);

export default router;
