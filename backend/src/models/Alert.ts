import mongoose, { Document } from "mongoose";

export interface IAlert extends Document {
  user: mongoose.Types.ObjectId;
  product: mongoose.Types.ObjectId;
  targetPrice: number;
  triggered: boolean;
  triggeredAt?: Date;
  createdAt: Date;
}

const alertSchema = new mongoose.Schema<IAlert>(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    targetPrice: { type: Number, required: true },
    triggered: { type: Boolean, default: false },
    triggeredAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model<IAlert>("Alert", alertSchema);
