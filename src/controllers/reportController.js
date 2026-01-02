import Bill from "../models/bill.js";

/* ================= GET ALL REPORTS ================= */
export const allReports = async (req, res) => {
  try {
    const bills = await Bill.find()
      .populate("customerId", "firstName lastName phoneNumber gstNumber") 
      .populate("agentId", "name")
      .sort({ billDate: -1 });

    res.status(200).json({ success: true, bills });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET REPORTS BY DATE RANGE
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

    end.setHours(23, 59, 59, 999); // Include the full end day

    const bills = await Bill.find({
      billDate: { $gte: start, $lte: end },
    })
      .populate("customerId", "firstName lastName phoneNumber gstNumber")
      .populate("agentId", "name")
      .sort({ billDate: -1 });

    res.status(200).json({ success: true, bills });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};