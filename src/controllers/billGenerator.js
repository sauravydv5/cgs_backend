import Bill from "../models/bill.js";

export const generateBillByCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;

    const bills = await Bill.find({ customerId })
      .sort({ createdAt: -1 })
      .populate("customerId");

    if (!bills || bills.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No bills found for this customer.",
      });
    }

    const customer = bills[0].customerId || {};

    let allItems = [];
    bills.forEach((bill) => {
      if (Array.isArray(bill.items)) {
        allItems = allItems.concat(
          bill.items.map((item) => ({
            ...item.toObject(),
            billNo: bill.billNo,
            billDate: bill.createdAt,
          }))
        );
      }
    });

    const htmlContent = getInvoiceTemplate(customer, allItems);
    const base64Html = Buffer.from(htmlContent).toString("base64");

    res.status(200).json({
      success: true,
      url: `data:text/html;base64,${base64Html}`,
    });
  } catch (error) {
    console.error("Error generating bill:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate bill.",
    });
  }
};

const getInvoiceTemplate = (customer, items) => {
  // Calculate per-item values and totals
  const calculatedItems = items.map((item) => {
    const qty = Number(item.qty) || 0;
    const rate = Number(item.rate) || 0;
    const discountPercent = Number(item.discountPercent) || 0;

    const base = qty * rate; // gross amount before discount
    const discount = (base * discountPercent) / 100; // discount amount
    const taxable = base - discount; // taxable after discount

    // Determine GST rate (existing business rule)
    const gstRate = item.hsnCode === "3304" ? 5 : 3;
    const cgst = (taxable * gstRate) / 200; // half of gstRate
    const sgst = (taxable * gstRate) / 200;

    const finalAmount = taxable + cgst + sgst; // total for this line

    return {
      ...item,
      qty,
      rate,
      base,
      discount,
      taxable,
      cgst,
      sgst,
      finalAmount,
      gstRate,
    };
  });

  // Totals
  const totalGross = calculatedItems.reduce((s, it) => s + (it.base || 0), 0);
  const totalDiscount = calculatedItems.reduce((s, it) => s + (it.discount || 0), 0);
  const totalTaxable = calculatedItems.reduce((s, it) => s + (it.taxable || 0), 0);
  const totalCGST = calculatedItems.reduce((s, it) => s + (it.cgst || 0), 0);
  const totalSGST = calculatedItems.reduce((s, it) => s + (it.sgst || 0), 0);
  const totalTax = totalCGST + totalSGST;
  const finalAmount = calculatedItems.reduce((s, it) => s + (it.finalAmount || 0), 0);

  const currentDate = new Date().toLocaleDateString("en-IN");
  const currentTime = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const customerName =
    customer.name ||
    (customer.firstName
      ? `${customer.firstName} ${customer.lastName || ""}`
      : "N/A");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Tax Invoice</title>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 0; padding: 20px; }
    .invoice-box { max-width: 800px; margin: auto; padding: 30px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0, 0, 0, 0.15); font-size: 14px; line-height: 24px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
    .company-details { text-align: right; }
    .company-title { font-size: 24px; font-weight: bold; color: #555; margin-bottom: 5px; }
    table { width: 100%; line-height: inherit; text-align: left; border-collapse: collapse; }
    table th { background: #f8f8f8; font-weight: bold; padding: 10px; border: 1px solid #eee; font-size: 12px; }
    table td { padding: 10px; border: 1px solid #eee; font-size: 12px; }
    .totals { margin-top: 20px; display: flex; justify-content: flex-end; }
    .totals-table { width: 300px; }
    .totals-table td { padding: 5px 10px; }
    .total-row { font-weight: bold; font-size: 16px; border-top: 2px solid #333; }
    .footer { margin-top: 30px; font-size: 12px; text-align: center; color: #555; }
  </style>
</head>

<body>
<div class="invoice-box">

<div class="header">
  <div>
    <div style="font-size:20px;font-weight:bold;">CHEAP GENERAL STORE</div>
    <div>ADALAT BAZAR, PATIALA</div>
    <div>Phone: 0175-5005318, 9592472590</div>
    <div>GST No: 03AAATFC8302N1Z5</div>
  </div>

  <div class="company-details">
    <div class="company-title">TAX INVOICE</div>
    <div>GST BILL</div>
  </div>
</div>

<div style="display:flex;justify-content:space-between;margin-bottom:20px;">
  <div>
    <strong>Bill To:</strong><br/>
    ${customerName}<br/>
    ${customer.address || ""}<br/>
    ${customer.phoneNumber || ""}
  </div>

  <div style="text-align:right;">
    <strong>Bill No:</strong> ${calculatedItems[0]?.billNo || "-"}<br/>
    <strong>Date:</strong> ${currentDate}<br/>
    <strong>Time:</strong> ${currentTime}
  </div>
</div>

<table>
<thead>
<tr>
  <th>SL</th>
  <th>ITEM NAME</th>
  <th>HSN CODE</th>
  <th>QTY</th>
  <th>RATE</th>
  <th>DIS%</th>
  <th>DIS AMT</th>
  <th>AMT</th>
</tr>
</thead>
<tbody>
${calculatedItems
  .map(
    (item, i) => `
<tr>
  <td>${i + 1}</td>
  <td>${item.itemName}</td>
  <td>${item.hsnCode || "-"}</td>
  <td class="center">${item.qty}</td>
  <td class="right">₹${item.rate.toFixed(2)}</td>
  <td class="center">${item.discountPercent || 0}%</td>
  <td class="right">₹${(item.discount || 0).toFixed(2)}</td>
  <td class="right">₹${(item.finalAmount || 0).toFixed(2)}</td>
</tr>`
  )
  .join("")}
</tbody>
</table>

<div class="totals">
<table class="totals-table">
<tr>
  <td>AMOUNT:</td>
  <td style="text-align:right;">₹${totalGross.toFixed(2)}</td>
</tr>
<tr>
  <td>DIS.:</td>
  <td style="text-align:right;">₹${totalDiscount.toFixed(2)}</td>
</tr>
<tr>
  <td>AMT AFT DIS:</td>
  <td style="text-align:right;">₹${totalTaxable.toFixed(2)}</td>
</tr>
<tr>
  <td>CGST:</td>
  <td style="text-align:right;">₹${totalCGST.toFixed(2)}</td>
</tr>
<tr>
  <td>SGST:</td>
  <td style="text-align:right;">₹${totalSGST.toFixed(2)}</td>
</tr>
<tr class="total-row">
  <td>BILL AMT:</td>
  <td style="text-align:right;">₹${finalAmount.toFixed(2)}</td>
</tr>
</table>
</div>

<div class="footer">
ALL DISPUTES SUBJECT TO PATIALA JURISDICTION<br/>
THIS IS COMPUTER GENERATED INVOICE
</div>

</div>
</body>
</html>
`;
};
