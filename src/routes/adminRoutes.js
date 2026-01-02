import express from "express";
import { adminLogin, verifyAdminOtp } from "../controllers/adminController.js";

const router = express.Router();

router.post("/login", adminLogin);
router.post("/otp/verify", verifyAdminOtp);

export default router;
