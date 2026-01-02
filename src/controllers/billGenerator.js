import Bill from "../models/bill.js";

export const generateBillByCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;

    // Fetch ALL bills for this customer to generate a consolidated report
    const bills = await Bill.find({ customerId })
      .sort({ createdAt: -1 })
      .populate("customerId");

    if (!bills || bills.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No bills found for this customer.",
      });
    }

    // Use customer details from the first bill found
    const customer = bills[0].customerId || {};

    // Aggregate items from all bills into a single list
    let allItems = [];
    bills.forEach((bill) => {
      if (bill.items && Array.isArray(bill.items)) {
        const billItems = bill.items.map((item) => ({
          ...item.toObject(),
          billNo: bill.billNo, // Attach bill number to each item for reference
          billDate: bill.createdAt,
        }));
        allItems = allItems.concat(billItems);
      }
    });

    // Generate the HTML content
    const htmlContent = getInvoiceTemplate(customer, allItems);

    // Convert HTML to Base64 Data URL
    const base64Html = Buffer.from(htmlContent).toString("base64");
    const dataUrl = `data:text/html;base64,${base64Html}`;

    res.status(200).json({
      success: true,
      url: dataUrl,
    });
  } catch (error) {
    console.error("Error generating bill:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate bill.",
    });
  }
};

// Helper function to format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount || 0);
};

// Helper function to generate HTML
const getInvoiceTemplate = (customer, items) => {
  // Calculate totals
  const totalAmount = items.reduce((sum, item) => sum + (Number(item.total) || Number(item.netAmount) || 0), 0);
  const currentDate = new Date().toLocaleDateString("en-IN");
  
  const customerName = customer.name || 
    (customer.firstName ? `${customer.firstName} ${customer.lastName || ""}` : "N/A");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Consolidated Invoice</title>
  <style>
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 0; padding: 20px; }
    .invoice-box { max-width: 800px; margin: auto; padding: 30px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0, 0, 0, 0.15); font-size: 14px; line-height: 24px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
    .company-details { text-align: right; }
    .company-title { font-size: 24px; font-weight: bold; color: #E57373; margin-bottom: 5px; }
    .invoice-title { font-size: 28px; font-weight: bold; color: #555; text-align: center; margin-bottom: 20px; letter-spacing: 2px; }
    
    .info-section { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .bill-to { flex: 1; }
    .invoice-meta { flex: 1; text-align: right; }
    
    table { width: 100%; line-height: inherit; text-align: left; border-collapse: collapse; }
    table th { background: #f8f8f8; color: #333; font-weight: bold; padding: 10px; border: 1px solid #eee; font-size: 12px; }
    table td { padding: 10px; border: 1px solid #eee; font-size: 12px; }
    table tr.item:nth-child(even) { background-color: #fcfcfc; }
    
    .totals { margin-top: 20px; display: flex; justify-content: flex-end; }
    .totals-table { width: 300px; }
    .totals-table td { padding: 5px 10px; border: none; }
    .totals-table .total-row { font-weight: bold; font-size: 16px; border-top: 2px solid #333; }
    
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #777; text-align: center; }
    .signature { margin-top: 40px; text-align: right; font-weight: bold; }
  </style>
</head>
<body>
  <div class="invoice-box">
    <div class="header">
      <div>
        <div style="font-size: 20px; font-weight: bold; color: #333;">CGS Backend</div>
        <div>123 Business Road, Tech City</div>
        <div>State, Country - 110001</div>
        <div>GSTIN: 07AAAAA0000A1Z5</div>
      </div>
      <div class="company-details">
        <div class="company-title">CONSOLIDATED INVOICE</div>
        <div>Statement of All Products</div>
      </div>
    </div>
    <div class="info-section">
      <div class="bill-to">
        <strong>Bill To:</strong><br />
        ${customerName}<br />
        ${customer.address || ""}<br />
        ${customer.phoneNumber ? `Phone: ${customer.phoneNumber}` : ""}
      </div>
      <div class="invoice-meta">
        <strong>Date:</strong> ${currentDate}<br />
        <strong>Total Items:</strong> ${items.length}
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="width: 5%;">S.No</th>
          <th style="width: 15%;">Bill No</th>
          <th style="width: 35%;">Item Name</th>
          <th style="width: 10%;">HSN</th>
          <th style="width: 10%;">Batch</th>
          <th style="width: 10%;">Qty</th>
          <th style="width: 10%;">Rate</th>
          <th style="width: 10%;">Disc %</th>
          <th style="width: 10%;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, index) => `
          <tr class="item">
            <td>${index + 1}</td>
            <td style="font-size: 10px; color: #555;">${item.billNo || "-"}</td>
            <td>
              ${item.itemName}
              <div style="font-size: 10px; color: #888;">${item.companyName || ""}</div>
            </td>
            <td>${item.hsnCode || "-"}</td>
            <td>${item.batch || "-"}</td>
            <td>${item.qty}</td>
            <td>${item.rate}</td>
            <td>${item.discountPercent || 0}%</td>
            <td style="text-align: right;">${(Number(item.total) || Number(item.netAmount) || 0).toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="totals">
      <table class="totals-table">
        <tr>
          <td>Sub Total:</td>
          <td style="text-align: right;">${formatCurrency(totalAmount)}</td>
        </tr>
        <tr class="total-row">
          <td>Grand Total:</td>
          <td style="text-align: right;">${formatCurrency(totalAmount)}</td>
        </tr>
      </table>
    </div>
    <div class="signature">
      <br/><br/>
      Authorized Signatory
    </div>
    <div class="footer">
      <p>Thank you for your business!</p>
      <p>Terms & Conditions: Goods once sold will not be taken back. Subject to local jurisdiction.</p>
    </div>
  </div>
</body>
</html>
  `;
};