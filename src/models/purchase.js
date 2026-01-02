// import mongoose from "mongoose";
// import Supplier from "./supplier.js";

// const purchaseSchema = new mongoose.Schema(
//   {
//     purchaseId: {
//       type: String,
//       required: true,
//       unique: true, // CGS0021
//     },
//     supplier: {
//       type: mongoose.Schema.Types.ObjectId,
//       required: true,
//       ref: "Supplier",
//     },

//     supplierName: { type: String, default: "" },
//     date: {
//       type: Date,
//       required: true,
//     },
//     totalAmount: {
//       type: Number,
//       required: true,
//     },
//     paymentMethod: {
//       type: String, // UPI, CASH, CARD
//       required: true,
//     },
//     status: {
//       type: String,
//       enum: ["PAID", "PENDING"],
//       default: "PAID",
//     },
//     items: [
//       {
//         product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
//         qty: Number,
//         rate: Number,
//         amount: Number,
//       },
//     ],
//   },
//   { timestamps: true }
// );

// purchaseSchema.pre("save", async function (next) {
//   if (this.isNew || this.isModified("supplier")) {
//     try {
//       if (this.supplier && mongoose.Types.ObjectId.isValid(this.supplier)) {
//         const supplierDoc = await Supplier.findById(this.supplier);
//         if (supplierDoc) {
//           this.supplierName = supplierDoc.name;
//         }
//       }
//     } catch (error) {
//       console.error("Error fetching supplier name:", error);
//     }
//   }
//   next();
// });

// export default mongoose.model("Purchase", purchaseSchema);


import mongoose from "mongoose";

const purchaseSchema = new mongoose.Schema(
  {
    purchaseId: {
      type: String,
      required: true,
      unique: true,
    },

    billNo: { type: String },

    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },

    supplierName: {
      type: String,
      default: "",
    },

    date: {
      type: Date,
      required: true,
    },

    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        qty: {
          type: Number,
          required: true,
          min: 1,
        },
        rate: {
          type: Number,
          required: true,
        },
        amount: {
          type: Number,
          required: true,
        },
      },
    ],

    totalAmount: {
      type: Number,
      required: true,
    },

    paymentMethod: {
      type: String,
      enum: ["CASH", "UPI", "CREDIT"],
      default: "CASH",
    },

    status: {
      type: String,
      enum: ["PAID", "PENDING"],
      default: "PAID",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Purchase", purchaseSchema);
