import Bill from "../models/bill.js";
import Order from "../models/order.js";

/* ================= GET ALL REPORTS ================= */
export const allReports = async (req, res) => {
  try {
    const bills = await Bill.find()
      .populate("customerId", "firstName lastName phoneNumber gstNumber")
      .populate("agentId", "name")
      .sort({ billDate: -1 });

    // Correct calculation: compute totalAmount for each bill if needed
    const billsWithTotal = bills.map((bill) => {
      // Use the stored netAmount directly as it contains the final bill value
      const totalAmount = bill.netAmount || 0;
      return { ...bill.toObject(), totalAmount };
    });

    res.status(200).json({ success: true, bills: billsWithTotal });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ================= GET REPORTS BY DATE RANGE ================= */
export const getReportsByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and End date are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format",
      });
    }

    end.setHours(23, 59, 59, 999); // Include full end day

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (start > today || end > today) {
      return res.status(400).json({
        success: false,
        message: "Future dates are not allowed",
      });
    }

    if (end < start) {
      return res.status(400).json({ success: false, message: "End date cannot be prior to start date" });
    }

    const bills = await Bill.find({
      billDate: { $gte: start, $lte: end },
    })
      .populate("customerId", "firstName lastName phoneNumber gstNumber")
      .populate("agentId", "name")
      .sort({ billDate: -1 });

    // Correct calculation
    const billsWithTotal = bills.map((bill) => {
      // Use the stored netAmount directly as it contains the final bill value
      const totalAmount = bill.netAmount || 0;
      return { ...bill.toObject(), totalAmount };
    });

    res.status(200).json({ success: true, bills: billsWithTotal });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ================= GET AGGREGATED SALES REPORTS ================= */
export const getSalesReports = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = "month" } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and End date are required",
      });
    }

    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.999Z`);

    const dateFilter = {
      billDate: { $gte: start, $lte: end },
    };

    let groupById, projectFields, sortFields;

    switch (groupBy) {
      case "day":
        groupById = {
          year: { $year: "$billDate" },
          month: { $month: "$billDate" },
          day: { $dayOfMonth: "$billDate" },
        };
        projectFields = {
          _id: 0,
          year: "$_id.year",
          month: "$_id.month",
          day: "$_id.day",
          total: 1,
          count: 1,
        };
        sortFields = { year: 1, month: 1, day: 1 };
        break;
      case "year":
        groupById = {
          year: { $year: "$billDate" },
        };
        projectFields = { _id: 0, year: "$_id.year", total: 1, count: 1 };
        sortFields = { year: 1 };
        break;
      case "month":
      default:
        groupById = {
          year: { $year: "$billDate" },
          month: { $month: "$billDate" },
        };
        projectFields = {
          _id: 0,
          year: "$_id.year",
          month: "$_id.month",
          total: 1,
          count: 1,
        };
        sortFields = { year: 1, month: 1 };
        break;
    }

    const salesData = await Bill.aggregate([
      { $match: dateFilter },
      { $group: { _id: groupById, total: { $sum: "$netAmount" }, count: { $sum: 1 } } },
      { $project: projectFields },
      { $sort: sortFields },
    ]);

    res.status(200).json({ success: true, data: salesData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/* ================= GET AGGREGATED ORDER REPORTS ================= */
export const getOrderReports = async (req, res) => {
  try {
    const { startDate, endDate, groupBy = "month" } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Start date and End date are required",
      });
    }

    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T23:59:59.999Z`);

    const dateFilter = {
      createdAt: { $gte: start, $lte: end },
      paymentStatus: "completed",
    };

    let groupById, projectFields, sortFields;

    switch (groupBy) {
      case "day":
        groupById = {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" },
        };
        projectFields = { _id: 0, year: "$_id.year", month: "$_id.month", day: "$_id.day", total: 1, count: 1 };
        sortFields = { year: 1, month: 1, day: 1 };
        break;
      case "year":
        groupById = { year: { $year: "$createdAt" } };
        projectFields = { _id: 0, year: "$_id.year", total: 1, count: 1 };
        sortFields = { year: 1 };
        break;
      case "month":
      default:
        groupById = { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } };
        projectFields = { _id: 0, year: "$_id.year", month: "$_id.month", total: 1, count: 1 };
        sortFields = { year: 1, month: 1 };
        break;
    }

    const orderData = await Order.aggregate([
      { $match: dateFilter },
      { $group: { _id: groupById, total: { $sum: "$totalPrice" }, count: { $sum: 1 } } },
      { $project: projectFields },
      { $sort: sortFields },
    ]);

    res.status(200).json({ success: true, data: orderData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
