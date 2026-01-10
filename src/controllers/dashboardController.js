import Bill from "../models/bill.js";
import Order from "../models/order.js";
import Product from "../models/product.js";
import StockAlert from "../models/stock.js";
import Purchase from "../models/purchase.js";
import User from "../models/user.js";
import { USER_ROLES } from "../constants/auth.js";

export const getDashboardData = async (req, res) => {
  try {
    /* =========================
       DASHBOARD CARDS
    ========================== */

    // 💰 Total Sales (netAmount from Bill)
   const totalSalesAgg = await Bill.aggregate([
  { $unwind: "$items" },
  {
    $group: {
      _id: null,
      total: { $sum: "$items.taxableAmount" } // AMT AFT DIS
    }
  }
]);

const totalSalesAmount = totalSalesAgg[0]?.total || 0;

    // 📦 Total Orders (Bills = Orders)
    const totalOrders = await Bill.countDocuments();

    // 👥 Active Customers (User model only)
    const activeCustomers = await User.countDocuments({
      role: USER_ROLES.CUSTOMER,
      isBlocked: false,
    });

    // ⚠️ Low Stock Products
    // Fetch threshold from settings, default to 10 if not set
    let settings = await StockAlert.findOne();
    if (!settings) {
      settings = { threshold: 10 }; // Use default if no settings exist
    }
    const threshold = settings.threshold;

    const lowStockCount = await Product.countDocuments({ stock: { $lte: threshold } });

    /* =========================
       SALES CHART (MONTH WISE)
    ========================== */
    const salesChart = await Bill.aggregate([
      {
        $group: {
          _id: { $month: "$createdAt" },
          total: { $sum: "$netAmount" },
        },
      },
      {
        $project: {
          month: "$_id",
          total: 1,
          _id: 0,
        },
      },
      { $sort: { month: 1 } },
    ]);

    /* =========================
       PRODUCT PERFORMANCE
       (from bill.items[])
    ========================== */
   const productPerformance = await Bill.aggregate([
  { $unwind: "$items" },
  {
    $group: {
      _id: "$items.itemName",
      sold: { $sum: "$items.qty" }
    }
  },
  {
    $project: {
      productName: "$_id",
      sold: 1,
      _id: 0
    }
  },
  { $limit: 6 }
]);


    /* =========================
       FINAL RESPONSE
    ========================== */
    res.status(200).json({
      success: true,
      data: {
        cards: {
          totalSalesAmount: Math.round(totalSalesAmount),
          totalOrders,
          activeCustomers,
          lowStockCount,
        },
        charts: {
          salesChart,
          productPerformance,
        },
      },
      message: "Dashboard data fetched successfully",
    });
  } catch (error) {
    console.error("Dashboard Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load dashboard data",
    });
  }
};


//date range


export const getDashboardDataByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "startDate and endDate are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // 🔴 IMPORTANT

    const dateFilter = {
      createdAt: {
        $gte: start,
        $lte: end,
      },
    };

    /* =========================
       TOTAL SALES
    ========================== */
    const totalSalesAgg = await Bill.aggregate([
      { $match: dateFilter },
      { $unwind: "$items" },
      {
        $group: {
          _id: null,
          total: { $sum: "$items.taxableAmount" },
        },
      },
    ]);

    const totalSalesAmount = Math.round(totalSalesAgg[0]?.total || 0);

    /* =========================
       TOTAL ORDERS
    ========================== */
    const totalOrders = await Bill.countDocuments(dateFilter);

    /* =========================
       ACTIVE CUSTOMERS
    ========================== */
    const activeCustomers = await User.countDocuments({
      role: USER_ROLES.CUSTOMER,
      isBlocked: false,
    });

    /* =========================
       LOW STOCK
    ========================== */
    const settings = await StockAlert.findOne();
    const threshold = settings?.threshold || 10;

    const lowStockCount = await Product.countDocuments({
      stock: { $lte: threshold },
    });

    /* =========================
       SALES CHART
    ========================== */
    const salesChart = await Bill.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: { $month: "$createdAt" },
          total: { $sum: "$netAmount" },
        },
      },
      {
        $project: {
          month: "$_id",
          total: 1,
          _id: 0,
        },
      },
      { $sort: { month: 1 } },
    ]);

    /* =========================
       PRODUCT PERFORMANCE
    ========================== */
    const productPerformance = await Bill.aggregate([
      { $match: dateFilter },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.itemName",
          sold: { $sum: "$items.qty" },
        },
      },
      {
        $project: {
          productName: "$_id",
          sold: 1,
          _id: 0,
        },
      },
      { $limit: 6 },
    ]);

    res.status(200).json({
      success: true,
      data: {
        cards: {
          totalSalesAmount,
          totalOrders,
          activeCustomers,
          lowStockCount,
        },
        charts: {
          salesChart: salesChart || [],
          productPerformance: productPerformance || [],
        },
      },
      message: "Dashboard date range data fetched successfully",
    });
  } catch (error) {
    console.error("Dashboard Date Range Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load dashboard date range data",
    });
  }
};

