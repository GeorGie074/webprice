import mongoose, { Document } from "mongoose";

/**
 * SearchLog — one record per search query.
 * Used for dashboard stats:
 *  • Today's search count
 *  • Most searched terms
 */
export interface ISearchLog extends Document {
  query: string;
  userId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const searchLogSchema = new mongoose.Schema<ISearchLog>(
  {
    query:  { type: String, required: true, lowercase: true, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

// TTL index: auto-delete logs older than 90 days
searchLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default mongoose.model<ISearchLog>("SearchLog", searchLogSchema);
