import mongoose from "mongoose";

const billItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },

    sno: Number,
    itemCode: String,
    itemName: String,
    companyName: String,
    hsnCode: String,
    packing: String,
    batch: String,

    qty: { type: Number, default: 0 },
    freeQty: { type: Number, default: 0 },

    mrp: Number,
    rate: Number,

    discountPercent: Number,
    discountAmount: Number,

    taxableAmount: Number,
    gstPercent: Number,
    cgst: Number,
    sgst: Number,
    igst: Number,

    total: Number,
  },
  { _id: false }
);

const billSchema = new mongoose.Schema(
  {
    /* ================= CUSTOMER / AGENT ================= */
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    customerName: { type: String, default: "" },

    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    /* ================= BILL INFO ================= */
    billNo: { type: String, unique: true },
    billDate: { type: Date, default: Date.now },

    /* ================= ITEMS ================= */
    items: [billItemSchema],

    /* ================= TOTALS ================= */
    totalQty: Number,
    grossAmount: Number,

    totalDiscount: Number,
    taxableAmount: Number,

    totalCGST: Number,
    totalSGST: Number,
    totalIGST: Number,

    roundOff: Number,
    netAmount: Number,

    /* ================= PAYMENT ================= */
    paymentMode: {
      type: String,
      enum: ["Cash", "UPI", "Card", "Credit"],
      default: "Cash",
    },

    paidAmount: Number,
    balanceAmount: Number,

    paymentStatus: {
      type: String,
      enum: ["Paid", "Unpaid", "Partial", "Draft"],
      default: "Unpaid",
    },

    notes: String,

    /* ================= AUDIT ================= */
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

billSchema.pre("save", async function (next) {
  if (this.isModified("customerId") && this.customerId) {
    try {
      const User = mongoose.model("User");
      const customer = await User.findById(this.customerId);
      if (customer) {
        this.customerName = customer.name || `${customer.firstName} ${customer.lastName}`.trim();
      }
    } catch (error) {
      console.error("Error fetching customer name:", error);
    }
  }
  next();
});

export default mongoose.model("bill", billSchema);
