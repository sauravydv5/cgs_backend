import dotenv from "dotenv";
import { connectDB, disconnectDB } from "../config/db.js";
import Admin from "../models/admin.js";

dotenv.config();

const seedAdmin = async () => {
  try {
    await connectDB();

    const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123";
    const adminPhone = process.env.ADMIN_PHONE || "9876543210";

    let admin = await Admin.findOne({ email: adminEmail });

    if (!admin) {
      console.log("Creating new admin...");
      admin = new Admin({
        firstName: "Super",
        lastName: "Admin",
        email: adminEmail,
        phoneNumber: adminPhone,
        password: adminPassword,
        role: "admin",
        dateofBirth: new Date("1990-01-01"),
      });
    } else {
      console.log("Admin found. Updating OTP...");
    }

    // Generate OTP
    const otp = parseInt(process.env.OTP) || 1234;
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    admin.otp = otp;
    admin.otpExpiresAt = expiresAt;

    if (!admin.dateofBirth) {
      admin.dateofBirth = new Date("1990-01-01");
    }

    await admin.save();

    console.log("------------------------------------------------");
    console.log("✅ Admin Seeded/Updated Successfully");
    console.log("------------------------------------------------");
    console.log(`👤 Name: ${admin.firstName} ${admin.lastName}`);
    console.log(`📧 Email: ${admin.email}`);
    console.log(`📱 Phone: ${admin.phoneNumber}`);
    console.log(`🎂 DOB:   ${admin.dateofBirth ? admin.dateofBirth.toISOString().split("T")[0] : "N/A"}`);
    console.log(`🔑 OTP:  ${admin.otp}`); // OTP included in response
    console.log("------------------------------------------------");
  } catch (err) {
    console.error(err);
  } finally {
    await disconnectDB();
  }
};

seedAdmin();
