
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { createServer } from "http";
import { connectDB } from "./config/db.js";
import { initializeSocket } from "./services/socketService.js";
import { startOrderTrackingService } from "./services/orderTrackingService.js";

import authRoutes from "./routes/authRoutes.js";

import cartRoutes from "./routes/cartRoutes.js";

import orderRoutes from "./routes/orderRoutes.js";

import productRoutes from "./routes/productRoutes.js";

// import profileRoutes from "./routes/profileRoutes.js";

import addressRoutes from "./routes/addressRoutes.js";

import categoryRoutes from "./routes/categoryRoutes.js";

import customerRoutes from "./routes/customerRoutes.js";
// import ticketRoutes from "./routes/ticketRoutes.js";

import billRoutes from "./routes/billRoutes.js";

import ledgerRoutes from "./routes/ledgerRoutes.js";

import supplierRoutes from "./routes/supplierRoutes.js";

import adminRoutes from "./routes/adminRoutes.js";

import purchaseRoutes from "./routes/purchaseRoutes.js";

import purchaseReturnRoutes from "./routes/purchaseReturnRoutes.js";

import saleReturnRoutes from "./routes/saleReturnRoutes.js";

import reportRoutes from "./routes/reportRoutes.js";

import dashboardRoutes from "./routes/dashboardRoutes.js";

import roleRoutes from "./routes/roleRoutes.js";

import employeeRoutes from "./routes/employeeRoutes.js";


dotenv.config();
connectDB();

const app = express();
app.use(cors());

// Webhook route needs raw body for signature verification
// Register it before express.json() middleware
app.use("/api/orders/webhook/razorpay", express.raw({ type: "application/json" }));

app.use("/uploads", express.static("uploads"));

app.use(express.json());

app.use((req, _, next) => {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const offset = (page - 1) * limit;

  req.page = page;
  req.limit = limit;
  req.offset = offset;

  next();
})

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/products", productRoutes);
// app.use("/api/profile", profileRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/customers", customerRoutes);
// app.use("/api/tickets", ticketRoutes);
app.use("/api/bills", billRoutes);
app.use("/api/ledger", ledgerRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/purchase-returns", purchaseReturnRoutes);
app.use("/api/sale-returns", saleReturnRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/employees", employeeRoutes);



app.get("/", (_, res) => res.send("E-commerce backend running correctly ✅"));

const PORT = process.env.PORT || 3000;

// Create HTTP server for Socket.IO
const httpServer = createServer(app);

// Initialize Socket.IO
initializeSocket(httpServer);

// Start automatic order tracking service
startOrderTrackingService();

httpServer.listen(PORT, () => {
  console.log(`Server running on this http://localhost:${PORT}`);
  console.log(`Socket.IO server initialized for live order tracking`);
});
