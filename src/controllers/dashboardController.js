import Bill from "../models/bill.js";
import Product from "../models/product.js";
import StockAlert from "../models/stock.js";
import User from "../models/user.js";
import { USER_ROLES } from "../constants/auth.js";

/* ======================================================
   NORMAL DASHBOARD (OPTIONAL DATE FILTER)
====================================================== */
export const getDashboardData = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const matchStage = {};

    if (startDate && endDate) {
      const start = new Date(`${startDate}T00:00:00.000Z`);
      const end = new Date(`${endDate}T23:59:59.999Z`);
      matchStage.billDate = { $gte: start, $lte: end };
    }

    /* =========================
       TOTAL SALES
    ========================== */
    const totalSalesAgg = await Bill.aggregate([
      { $match: matchStage },
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
    const totalOrders = await Bill.countDocuments(matchStage);

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
      $expr: {
        $and: [
          { $gt: ["$stock", 0] },
          { $lte: ["$stock", { $ifNull: ["$lowStockThreshold", threshold] }] },
        ],
      },
    });

    /* =========================
       SALES CHART (MONTH + YEAR)
    ========================== */
    const salesChart = await Bill.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            year: { $year: "$billDate" },
            month: { $month: "$billDate" },
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
      { $match: matchStage },
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

/* ======================================================
   DASHBOARD WITH DATE RANGE (STRICT)
====================================================== */
export const getDashboardDataByDateRange = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = "day" } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "startDate and endDate are required",
      });
    }

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
      $expr: {
        $and: [
          { $gt: ["$stock", 0] },
          { $lte: ["$stock", { $ifNull: ["$lowStockThreshold", threshold] }] },
        ],
      },
    });

    /* =========================
       SALES CHART
    ========================== */
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

    const salesChart = await Bill.aggregate([
      { $match: dateFilter },
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
