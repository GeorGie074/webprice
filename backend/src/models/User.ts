import mongoose, { Document } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  /** Optional — Google OAuth users don't have a local password */
  password?: string;
  /** Google OAuth user ID */
  googleId?: string;
  role: "user" | "admin";
  avatar?: string;
  lineNotifyToken?: string;
  wishlist: mongoose.Types.ObjectId[];
  /** When true the account is suspended — cannot log in */
  suspended: boolean;
  /** Last 30 search queries the user performed */
  searchHistory: Array<{ query: string; at: Date }>;
  createdAt: Date;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    name:     { type: String, required: true, trim: true },
    email:    { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: false },   // optional — not set for Google users
    googleId: { type: String, sparse: true },       // sparse index = unique but allows many nulls
    role:     { type: String, enum: ["user", "admin"], default: "user" },
    avatar:   { type: String },
    lineNotifyToken: { type: String },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    suspended: { type: Boolean, default: false },
    searchHistory: {
      type: [{ query: String, at: { type: Date, default: Date.now }, _id: false }],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>("User", userSchema);
