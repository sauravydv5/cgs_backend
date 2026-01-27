import mongoose from "mongoose";

const customerRatingSettingSchema = new mongoose.Schema(
  {
    star1Min: { type: Number, default: 0 },
    star1Max: { type: Number, default: 0 },
    star2Min: { type: Number, default: 0 },
    star2Max: { type: Number, default: 0 },
    star3Min: { type: Number, default: 0 },
    star3Max: { type: Number, default: 0 },
    star4Min: { type: Number, default: 0 },
    star4Max: { type: Number, default: 0 },
    star5Min: { type: Number, default: 0 },
    star5Max: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model(
  "CustomerRatingSetting",
  customerRatingSettingSchema
);