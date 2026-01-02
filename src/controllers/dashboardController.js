import Bill from "../models/bill.js";
import Order from "../models/order.js";
import Product from "../models/product.js";
import StockAlert from "../models/stock.js";
import Purchase from "../models/purchase.js";
import User from "../models/user.js";

export const getDashboardData = async (req, res) => {
  try {
    /* =========================
       DASHBOARD CARDS
    ========================== */

    // 💰 Total Sales (netAmount from Bill)
    const totalSalesAgg = await Bill.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: "$netAmount" },
        },
      },
    ]);

    const totalSalesAmount = totalSalesAgg[0]?.total || 0;

    // 📦 Total Orders (Bills = Orders)
    const totalOrders = await Bill.countDocuments();

    // 👥 Active Customers (User model only)
    const activeCustomers = await User.countDocuments();

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
