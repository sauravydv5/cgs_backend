import Bill from "../models/bill.js";
import SaleReturn from "../models/saleReturn.js";

export const generateBillByCustomer = async (req, res) => {
  try {
    const customerId = req.params.customerId || req.params.id;

    const [bills, saleReturns] = await Promise.all([
      Bill.find({ customerId })
        .sort({ createdAt: -1 })
        .populate("customerId"),
      SaleReturn.find({ customerId })
        .sort({ createdAt: -1 })
        .populate("items.productId", "productName hsnCode"),
    ]);

    if (!bills || bills.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No bills found for this customer.",
      });
    }

    const customer = bills[0].customerId || {};

    // Create a map of bill items for quick lookup of discount info
    const billItemMap = new Map();
    bills.forEach((bill) => {
      if (Array.isArray(bill.items)) {
        bill.items.forEach((item) => {
          const key = `${bill._id.toString()}_${item.productId.toString()}`;
          billItemMap.set(key, item);
        });
      }
    });

    const returnedItemKeys = new Set();
    let allReturnItems = [];
    saleReturns.forEach((ret) => {
      if (Array.isArray(ret.items)) {
        allReturnItems = allReturnItems.concat(
          ret.items.map((item) => {
            const key = `${ret.billId.toString()}_${item.productId?._id?.toString()}`;
            returnedItemKeys.add(key); // Track returned items

            const originalItem = billItemMap.get(key);

            return {
              ...item.toObject(),
              returnId: ret.returnId,
              billNo: ret.billNo,
              returnDate: ret.date,
              itemName: item.productId?.productName || "N/A",
              hsnCode: item.productId?.hsnCode || "-",
              discountPercent: Number(item.discountPercent ?? originalItem?.discountPercent ?? 0),
              gstPercent: Number(item.gstPercent ?? originalItem?.gstPercent ?? 0),
            };
          })
        );
      }
    });

    let allItems = [];
    bills.forEach((bill) => {
      if (Array.isArray(bill.items)) {
        // Filter out items that are in the return list
        const nonReturnedItems = bill.items.filter(item => {
          const key = `${bill._id.toString()}_${item.productId.toString()}`;
          return !returnedItemKeys.has(key);
        });
        allItems = allItems.concat(nonReturnedItems.map((item) => ({
            ...item.toObject(),
            billNo: bill.billNo,
            billDate: bill.createdAt,
        })));
      }
    });

    const htmlContent = getInvoiceTemplate(customer, allItems, allReturnItems);
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

const getInvoiceTemplate = (customer, items, returnItems) => {
  // ✅ Calculate Sale Items (SL) - matching frontend exactly
  const calculatedItems = items.map((item) => {
    const qty = Number(item.qty || 0);
    const rate = Number(item.rate || item.mrp || 0);
    const discountPercent = Number(item.discountPercent || 0);
    const gstPercent = Number(item.gstPercent || 0);

    // ✅ Frontend calculation logic
    const gross = rate * qty;
    const discountAmount = (gross * discountPercent) / 100;
    const taxable = gross - discountAmount;
    const cgst = (taxable * (gstPercent / 2)) / 100;
    const sgst = (taxable * (gstPercent / 2)) / 100;
    const total = taxable + cgst + sgst;

    return {
      ...item,
      qty,
      rate,
      discountPercent,
      gstPercent,
      base: gross,
      discount: discountAmount,
      taxable: taxable,
      cgst: cgst,
      sgst: sgst,
      finalAmount: total,
    };
  });

  // ✅ Calculate Return Items (SR) - matching frontend exactly
  const calculatedReturnItems = returnItems.map((item) => {
    const qty = Number(item.qty || 0);
    const rate = Number(item.rate || item.mrp || 0);
    const discountPercent = Number(item.discountPercent || 0);
    const gstPercent = Number(item.gstPercent || 0);

    // ✅ Frontend calculation logic
    const gross = rate * qty;
    const discountAmount = (gross * discountPercent) / 100;
    const taxable = gross - discountAmount;
    const cgst = (taxable * (gstPercent / 2)) / 100;
    const sgst = (taxable * (gstPercent / 2)) / 100;
    const total = taxable + cgst + sgst;

    return {
      ...item,
      qty,
      rate,
      discountPercent,
      gstPercent,
      base: gross,
      discountAmount: discountAmount,
      taxable: taxable,
      cgst: cgst,
      sgst: sgst,
      finalAmount: total,
    };
  });

  // ✅ Calculate Totals - EXACTLY matching frontend calculateTotals function
  const calculateTotals = (itemsArray) => {
    return itemsArray.reduce(
      (acc, item) => {
        acc.amount += item.base || 0;
        acc.discount += item.discount || item.discountAmount || 0;
        acc.tax += (item.cgst || 0) + (item.sgst || 0);
        acc.total += item.finalAmount || 0;
        return acc;
      },
      { amount: 0, discount: 0, tax: 0, total: 0 }
    );
  };

  const sl = calculateTotals(calculatedItems);
  const sr = calculateTotals(calculatedReturnItems);

  // ✅ EXACTLY matching frontend calculation
  const totalGross = sl.amount + sr.amount;           // AMOUNT
  const totalDiscount = sl.discount + sr.discount;    // DIS
  const amountAfterDiscount = totalGross - totalDiscount; // AMT AFT DIS
  const totalGST = sl.tax + sr.tax;                   // GST
  const grossTotal = sl.total + sr.total;             // Total Sale Value
  const netPayable = grossTotal - sr.total;           // NET PAYABLE

  const now = new Date();
  const currentDate = now.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" });
  const currentTime = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });

  const returnItemsHtml =
    returnItems.length > 0
      ? `
    <div style="margin-top: 30px;">
      <h3 style="border-bottom: 1px solid #eee; padding-bottom: 5px;">(SR)</h3>
      <table>
        <thead>
          <tr>
            <th>SR</th>
            <th>ITEM NAME</th>
            <th>HSN CODE</th>
            <th>QTY</th>
            <th>RATE</th>
            <th>CGST</th>
            <th>SGST</th>
            <th>DIS%</th>
            <th>AMT</th>
          </tr>
        </thead>
        <tbody>
          ${calculatedReturnItems
            .map(
              (item, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${item.itemName}</td>
            <td>${item.hsnCode || "-"}</td>
            <td class="center">${item.qty}</td>
            <td class="right">₹${(item.rate || 0).toFixed(2)}</td>
            <td class="right">₹${(item.cgst || 0).toFixed(2)}</td>
            <td class="right">₹${(item.sgst || 0).toFixed(2)}</td>
            <td class="center">${item.discountPercent || 0}%</td>
            <td class="right">₹${(item.finalAmount || 0).toFixed(2)}</td>
          </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `
      : "";

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
    .center { text-align: center; }
    .right { text-align: right; }
    .totals { margin-top: 20px; display: flex; justify-content: flex-end; }
    .totals-table { width: 300px; }
    .totals-table td { padding: 5px 10px; }
    .total-row { font-weight: bold; font-size: 16px; border-top: 2px solid #333; }
    .return-row { color: #d32f2f; }
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
  <div style="line-height: 1.5;">
    <strong>Bill To:</strong><br/>
    ${customerName}<br/>
    ${customer.phoneNumber || ""}
  </div>

  <div style="text-align:right;">
    <strong>Statement</strong><br/>
    <strong>Bill No:</strong> ${items[0]?.billNo || "-"}<br/>
    <strong>Date:</strong> ${currentDate}<br/>
    <strong>Issue Time:</strong> ${currentTime}
  </div>
</div>

<h3 style="border-bottom: 1px solid #eee; padding-bottom: 5px;">(SL)</h3>
<table>
<thead>
<tr>
  <th>SL</th>
  <th>ITEM NAME</th>
  <th>HSN CODE</th>
  <th>QTY</th>
  <th>RATE</th>
  <th>CGST</th>
  <th>SGST</th>
  <th>DIS%</th>
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
  <td class="right">₹${(item.cgst || 0).toFixed(2)}</td>
  <td class="right">₹${(item.sgst || 0).toFixed(2)}</td>
  <td class="center">${item.discountPercent || 0}%</td>
  <td class="right">₹${(item.finalAmount || 0).toFixed(2)}</td>
</tr>`
  )
  .join("")}
</tbody>
</table>

${returnItemsHtml}

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
  <td style="text-align:right;">₹${amountAfterDiscount.toFixed(2)}</td>
</tr>
<tr>
  <td>GST:</td>
  <td style="text-align:right;">₹${totalGST.toFixed(2)}</td>
</tr>
<tr style="font-weight: bold; border-top: 1px solid #eee;">
  <td>Total Sale Value:</td>
  <td style="text-align:right;">₹${grossTotal.toFixed(2)}</td>
</tr>
${
  returnItems.length > 0
    ? `
<tr class="return-row">
  <td>Return Discount:</td>
  <td style="text-align:right;">- ₹${sr.discount.toFixed(2)}</td>
</tr>
<tr class="return-row">
  <td>Return GST:</td>
  <td style="text-align:right;">- ₹${sr.tax.toFixed(2)}</td>
</tr>
<tr class="return-row">
  <td>Return Value:</td>
  <td style="text-align:right;">- ₹${sr.total.toFixed(2)}</td>
</tr>
`
    : ""
}
<tr class="total-row">
  <td>${netPayable >= 0 ? 'NET PAYABLE:' : 'REFUND AMOUNT:'}</td>
  <td style="text-align:right;${netPayable < 0 ? ' color: #2e7d32;' : ''}">₹${Math.abs(netPayable).toFixed(2)}</td>
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