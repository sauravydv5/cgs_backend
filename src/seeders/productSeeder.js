import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "../models/product.js";
import Category from "../models/category.js"; // make sure you have a Category model

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  }
};

const seedProducts = async () => {
  try {
    // 1️⃣ Ensure MongoDB connection
    await connectDB();

    // 2️⃣ Check or create a sample category
    let category = await Category.findOne({ name: "Beverages" });
    if (!category) {
      category = await Category.create({ name: "Beverages", description: "Soft drinks and juices" });
    }

    // 3️⃣ Sample product data
    const products = [
      {
        brandName: "Coca-Cola",
        productName: "Coke 500ml Bottle",
        category: category._id,
        company: "Coca-Cola Company",
        mrp: 40,
        costPrice: 30,
        stock: 100,
        itemCode: "CC500ML",
        gst: 18,
        hsnCode: "22021010",
        size: "500ml",
        discount: "10%",
        packSize: "Single",
        description: "Refreshing cold drink with great taste.",
        image: "https://example.com/images/coke500ml.jpg",
        productStatus: "active",
      },
      {
        brandName: "Pepsi",
        productName: "Pepsi 1L Bottle",
        category: category._id,
        company: "PepsiCo",
        mrp: 60,
        costPrice: 45,
        stock: 120,
        itemCode: "PEPSI1L",
        gst: 18,
        hsnCode: "22021020",
        size: "1L",
        discount: "5%",
        packSize: "Single",
        description: "Bold, refreshing cola flavor.",
        image: "https://example.com/images/pepsi1l.jpg",
        productStatus: "active",
      },
      {
        brandName: "Tropicana",
        productName: "Tropicana Orange Juice 1L",
        category: category._id,
        company: "PepsiCo",
        mrp: 120,
        costPrice: 90,
        stock: 80,
        itemCode: "TROPORANGE1L",
        gst: 12,
        hsnCode: "20091200",
        size: "1L",
        discount: "15%",
        packSize: "Single",
        description: "Fresh and natural orange juice with no added sugar.",
        image: "https://example.com/images/tropicana-orange.jpg",
        productStatus: "active",
      },
    ];

    // 4️⃣ Clear old data (optional)
    await Product.deleteMany();
    console.log("🗑️ Cleared existing products");

    // 5️⃣ Insert sample products
    await Product.insertMany(products);
    console.log("✅ Products seeded successfully");

    // 6️⃣ Close connection
    process.exit();
  } catch (err) {
    console.error("❌ Error seeding products:", err.message);
    process.exit(1);
  }
};

seedProducts();
