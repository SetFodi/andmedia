// models/User.ts
import mongoose, { Schema, Document, models, Model } from "mongoose";

// Define the interface for the User document
export interface IUser extends Document {
  username: string;
  email: string;
  password?: string; // Password will be hashed, optional for OAuth users
  name?: string; // Optional display name
  bio?: string;
  profilePicture?: string;
  followers: mongoose.Schema.Types.ObjectId[];
  following: mongoose.Schema.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

// Define the Mongoose schema
const UserSchema: Schema<IUser> = new Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, "Username must be at least 3 characters long"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/.+\@.+\..+/, "Please fill a valid email address"],
    },
    password: {
      type: String,
      // Required only if not using OAuth, handled in registration logic
      select: false, // Exclude password from query results by default
    },
    name: {
      type: String,
      trim: true,
    },
    bio: {
      type: String,
      maxlength: [160, "Bio cannot be more than 160 characters"],
    },
    profilePicture: {
      type: String,
      default: "/default-avatar.png", // Path to a default avatar image
    },
    followers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt fields
  }
);

// Prevent mongoose from recompiling the model if it already exists
const User: Model<IUser> = models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
