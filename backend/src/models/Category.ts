import mongoose, { Document } from "mongoose";

/**
 * Category — stores custom product categories added by admin.
 * The 6 default categories (smartphone, laptop, tablet, audio, home, fashion)
 * are always present in-app and don't need DB records, but admin can add extras.
 */
export interface ICategory extends Document {
  name: string;   // lowercase slug, e.g. "gaming"
  label: string;  // display label, e.g. "🎮 เกมมิ่ง"
  emoji: string;  // e.g. "🎮"
  createdAt: Date;
}

const categorySchema = new mongoose.Schema<ICategory>(
  {
    name:  { type: String, required: true, unique: true, lowercase: true, trim: true },
    label: { type: String, required: true, trim: true },
    emoji: { type: String, default: "📦" },
  },
  { timestamps: true }
);

export default mongoose.model<ICategory>("Category", categorySchema);
