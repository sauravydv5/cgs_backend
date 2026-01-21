import Bill from "../models/bill.js";
import Product from "../models/product.js";
import StockAlert from "../models/stock.js";
import Order from "../models/order.js";
import User from "../models/user.js";
import { USER_ROLES } from "../constants/auth.js";

/* ======================================================
   NORMAL DASHBOARD (NO DATE FILTER)
====================================================== */

export const getDashboardData = async (req, res) => {
  try {
    /* =========================
       TOTAL SALES
    ========================== */
    const totalSalesAgg = await Bill.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: "$netAmount" },
        },
      },
    ]);

    const totalSalesAmount = Math.round(totalSalesAgg[0]?.total || 0);

    /* =========================
       TOTAL ORDERS
    ========================== */
    const totalOrders = await Bill.countDocuments();

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
      stock: { $gt: 0, $lte: threshold },
    });

    /* =========================
   SALES CHART (MONTH + YEAR)
========================== */
const salesChart = await Bill.aggregate([
  {
    $group: {
      _id: {
        year: { $year: "$billDate" },   // ✅ FIX
        month: { $month: "$billDate" }, // ✅ FIX
      },
      total: { $sum: "$netAmount" },
    },
  },
  {
    $project: {
      year: "$_id.year",
      month: "$_id.month",
      total: { $round: ["$total", 0] },
      _id: 0,
    },
  },
  { $sort: { year: 1, month: 1 } },
]);


    /* =========================
       PRODUCT PERFORMANCE
    ========================== */
    const productPerformance = await Bill.aggregate([
      { $unwind: "$items" },
  {
    $group: {
      _id: "$items.itemName",
      sold: { $sum: "$items.qty" },
    },
  },
  { $sort: { sold: -1 } },
  { $limit: 6 },
  {
    $project: {
      productName: "$_id",
      sold: 1,
      _id: 0,
    },
  },
]);


    /* =========================
       RESPONSE
    ========================== */
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

/* =========================
   GET SALES CHART (Dynamic Grouping)
========================== */
export const getSalesChart = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = "day" } = req.query;

    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.999Z`);

    let groupId;
    let projectStage;
    let sortStage;

    if (groupBy === "month") {
      groupId = {
        year: { $year: "$billDate" },
        month: { $month: "$billDate" },
      };

      projectStage = {
        _id: 0,
        month: {
          $dateFromParts: {
            year: "$_id.year",
            month: "$_id.month",
            day: 1,
          },
        },
        total: { $round: ["$total", 0] },
        orders: 1,
      };

      sortStage = { month: 1 };
    } else {
      // ✅ DAY WISE
      groupId = {
        year: { $year: "$billDate" },
        month: { $month: "$billDate" },
        day: { $dayOfMonth: "$billDate" },
      };

      projectStage = {
        _id: 0,
        date: {
          $dateFromParts: {
            year: "$_id.year",
            month: "$_id.month",
            day: "$_id.day",
          },
        },
        total: { $round: ["$total", 0] },
        orders: 1,
      };

      sortStage = { date: 1 };
    }

    const data = await Bill.aggregate([
      { $match: { billDate: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: groupId,
          total: { $sum: "$netAmount" },
          orders: { $sum: 1 },
        },
      },
      { $project: projectStage },
      { $sort: sortStage },
    ]);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};




/* ======================================================
   DASHBOARD WITH DATE RANGE FILTER
====================================================== */

export const getDashboardDataByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "startDate and endDate are required",
      });
    }

    // ✅ SAFE DATE PARSING (NO TIMEZONE BUG)
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.999Z`);

    const dateFilter = {
  billDate: { $gte: start, $lte: end },
};

    /* =========================
       TOTAL SALES
    ========================== */
    const totalSalesAgg = await Bill.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: null,
          total: { $sum: "$netAmount" },
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
      stock: { $gt: 0, $lte: threshold },
    });


    /* =========================
       SALES CHART (MONTH + YEAR)
    ========================== */
    const salesChart = await Bill.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          total: { $sum: "$netAmount" },
        },
      },
      {
        $project: {
          year: "$_id.year",
          month: "$_id.month",
          total: { $round: ["$total", 0] },
          _id: 0,
        },
      },
      { $sort: { year: 1, month: 1 } },
    ]);

    /* =========================
       PRODUCT PERFORMANCE
    ========================== */
    /* =========================
   PRODUCT PERFORMANCE (DATE RANGE)
========================== */
const productPerformance = await Bill.aggregate([
  { $match: dateFilter }, // 👈 yahan start/end already defined hain
  { $unwind: "$items" },
  {
    $group: {
      _id: "$items.itemName",
      sold: { $sum: "$items.qty" },
    },
  },
  { $sort: { sold: -1 } },
  { $limit: 6 },
  {
    $project: {
      productName: "$_id",
      sold: 1,
      _id: 0,
    },
  },
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
          salesChart,
          productPerformance,
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
