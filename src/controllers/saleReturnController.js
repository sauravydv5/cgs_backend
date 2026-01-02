import SaleReturn from "../models/saleReturn.js";
import Bill from "../models/bill.js";
import Product from "../models/product.js";
// import Ledger from "../models/ledger.js";
import mongoose from "mongoose";

// ➕ ADD SALE RETURN
export const addSaleReturn = async (req, res) => {
  try {
    const { billId, date, items, reason, status } = req.body;

    // Basic validation to ensure required fields are present.
    if (!billId || !items || items.length === 0) {
      return res.status(400).json({ success: false, message: "Bill ID and items are required" });
    }

    // 1. Find Original Bill
    // Step 1: Find the original bill using the provided billId and populate customer details.
    // This is crucial for linking the return to the original transaction and customer.
    const bill = await Bill.findById(billId).populate("customerId");
    if (!bill) {
      return res.status(404).json({ success: false, message: "Bill not found" });
    }

    // 2. Generate Return ID (RET-001)
    // Step 2: Generate a unique, sequential Return ID (e.g., RET-001, RET-002).
    // This provides a human-readable identifier for the return transaction.
    const lastReturn = await SaleReturn.findOne().sort({ createdAt: -1 });
    let nextNum = 1;
    if (lastReturn && lastReturn.returnId) {
      const match = lastReturn.returnId.match(/(\d+)$/);
      if (match) nextNum = parseInt(match[1], 10) + 1;
    }
    const returnId = `RET-${String(nextNum).padStart(3, "0")}`;

    let totalAmount = 0;
    const processedItems = [];

    // 3. Process Items & Update Stock
    // Step 3: Loop through each item being returned.
    // Validate the product, calculate amounts, and update the product's stock.
    for (const item of items) {
      // Allow both 'productId' and 'product' for consistency with other modules
      const productId = item.productId || item.product;
      if (!productId) {
        return res.status(400).json({ success: false, message: "Each return item must have a product ID." });
      }

      // Find the product in the database.
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ success: false, message: `Product not found: ${productId}` });
      }

      // Support both 'qty' and 'quantity'
      // Support both 'qty' and 'quantity' keys from the request body for flexibility.
      const qty = Number(item.qty || item.quantity || 0);
      const rate = Number(item.rate);
      const amount = qty * rate;
      totalAmount += amount;

      // 🔥 Increase Stock (Return In)
      // 🔥 Increase the stock for the returned product.
      product.stock += qty;
      await product.save();

      processedItems.push({
        productId: product._id, // Standardize to productId for this model
        qty,
        rate,
        amount,
      });
    }

    // 4. Create Sale Return Record
    // Step 4: Create the main Sale Return document with all the processed information.
    // It determines the customer name from the original bill or the populated customer document.
    const customer = bill.customerId;
    let finalCustomerName = bill.customerName;
    if (!finalCustomerName && customer) {
      finalCustomerName = `${customer.firstName} ${customer.lastName}`.trim() || customer.customerCode || customer.phoneNumber;
    }

    const saleReturn = await SaleReturn.create({
      returnId,
      billId: bill._id,
      billNo: bill.billNo,
      customerId: bill.customerId._id,
      customerName: finalCustomerName,
      date: date || new Date(),
      items: processedItems,
      totalAmount,
      reason: reason || "",
      status: status || "PENDING",
    });

    // // 5. Create Ledger Entry (Credit Customer)
    // // Step 5: Create a corresponding ledger entry to credit the customer's account.
    // // This adjusts their balance to reflect the refund or credit note.
    // if (customer) {
    //   // Fetch last balance to calculate new balance
    //   const lastEntry = await Ledger.findOne({ partyCode: customer.customerCode }).sort({ date: -1, createdAt: -1 });
    //   const lastBalance = lastEntry ? lastEntry.balance : 0;
      
    //   // Customer Credit = Balance Decreases (We owe them or debt reduces)
    //   const newBalance = lastBalance - totalAmount;

    //   await Ledger.create({
    //     date: date || new Date(),
    //     partyType: "customer",
    //     partyCode: customer.customerCode || "UNKNOWN",
    //     partyName: `${customer.firstName} ${customer.lastName}`.trim(),
    //     mobileNumber: customer.phoneNumber,
    //     type: "Sale Return",
    //     referenceNo: returnId,
    //     credit: totalAmount,
    //     debit: 0,
    //     balance: newBalance,
    //     paymentMethod: "Return",
    //   });
    // }

    // 🔥 Populate response data
    // Step 6: Populate the newly created return document with details from related models.
    // This ensures the response sent back to the client contains full information (e.g., product names).
    const populatedReturn = await SaleReturn.findById(saleReturn._id)
      .populate("billId", "billNo")
      .populate("customerId", "firstName lastName phoneNumber")
      .populate("items.productId", "productName itemCode");

    res.status(201).json({ success: true, message: "Sale return added successfully", data: populatedReturn });

  } catch (error) {
    console.error("Add Sale Return Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 📄 GET ALL SALE RETURNS
export const getAllSaleReturns = async (req, res) => {
  // Fetches all sale return records from the database.
  try {
    const returns = await SaleReturn.find()
      .populate("billId", "billNo")
      .populate("customerId", "firstName lastName phoneNumber")
      .populate("items.productId", "productName itemCode")
      .sort({ createdAt: -1 });
    
    // Map to match frontend expectation if needed, or frontend can use .billNo
    // The data is mapped to ensure the 'billId' field matches the frontend's expectation
    // of seeing the string "BILL-XXX" instead of the MongoDB ObjectId.
    const data = returns.map(ret => ({
      ...ret.toObject(),
      billId: ret.billNo, // Frontend expects string "BILL-XXX" in billId column
      originalBillId: ret.billId // Keep reference
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 🔍 GET SINGLE RETURN
export const getSaleReturnById = async (req, res) => {
  // Fetches a single sale return by its MongoDB _id.
  try {
    const { id } = req.params;
    // Add a specific check to guide developers who use the wrong HTTP method
    if (id === 'add') {
      return res.status(405).json({ success: false, message: "Method Not Allowed. Please use a POST request to create a new sale return." });
    }

    // Add validation for ObjectId to prevent cast errors
    // Validates that the provided ID is a valid MongoDB ObjectId to prevent casting errors.
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ success: false, message: "Return not found" });
    }

    // Finds the return and populates related data.
    const saleReturn = await SaleReturn.findById(id)
      .populate("billId")
      .populate("customerId")
      .populate("items.productId");
    
    if (!saleReturn) {
      return res.status(404).json({ success: false, message: "Return not found" });
    }
    res.json({ success: true, data: saleReturn });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 🗑️ DELETE RETURN
export const deleteSaleReturn = async (req, res) => {
  // Deletes a sale return record.
  try {
    const { id } = req.params;
    const saleReturn = await SaleReturn.findById(id);
    if (!saleReturn) {
      return res.status(404).json({ success: false, message: "Return not found" });
    }

    // Rollback Stock (Decrease stock because we are cancelling the return)
    // Important: It rolls back the stock adjustment made during the return.
    // Since the return increased stock, deleting the return should decrease it.
    for (const item of saleReturn.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.qty }
      });
    }

    // Note: We are not deleting the Ledger entry automatically here to preserve audit trail, 
    // but in a strict system, you might want to reverse it via a Journal Entry or delete it.
    
    // Deletes the record from the database.
    await saleReturn.deleteOne();
    res.json({ success: true, message: "Sale return deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 🔄 UPDATE RETURN STATUS
export const updateSaleReturnStatus = async (req, res) => {
  // Updates the status of a sale return (e.g., from PENDING to APPROVED).
  try {
    const { id } = req.params;
    const { status } = req.body;

    // You might want to add logic here if status changes to 'APPROVED'
    // For example, confirming stock changes or ledger entries.
    // Currently, it's a simple status update.

    const saleReturn = await SaleReturn.findByIdAndUpdate(
      id,
      { status }, // Assuming your SaleReturn model has a 'status' field
      { new: true }
    );

    if (!saleReturn) {
      return res.status(404).json({ success: false, message: "Sale return not found" });
    }

    res.json({ success: true, message: "Status updated successfully", data: saleReturn });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✏️ UPDATE SALE RETURN
export const updateSaleReturn = async (req, res) => {
  // A general-purpose update function for a sale return.
  try {
    const { id } = req.params;

    // Be cautious with this. Updating a return might require recalculating totals,
    // reversing old stock changes, and applying new ones.
    // This is a simple update for now.
    // This implementation is a simple field update and does not handle such complex logic.
    const updatedReturn = await SaleReturn.findByIdAndUpdate(
      id,
      req.body,
      { new: true }
    );

    // If the record doesn't exist, return a 404.
    if (!updatedReturn) {
      return res.status(404).json({ success: false, message: "Sale return not found" });
    }

    // You would repopulate here if you want the full details in the response
    await updatedReturn.populate("billId customerId items.productId");

    res.json({ success: true, message: "Sale return updated successfully", data: updatedReturn });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};