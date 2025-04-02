// models/Post.ts
import mongoose, { Schema, Document, models, Model, Types } from "mongoose";
import { IUser } from "./User"; // Import IUser for author typing

// Interface for the Comment subdocument (optional for now, can be expanded later)
export interface IComment extends Document {
  user: Types.ObjectId | IUser; // Reference to the user who commented
  text: string;
  createdAt: Date;
}

// Define the interface for the Post document
export interface IPost extends Document {
  author: Types.ObjectId | IUser; // Reference to the User who created the post
  content: string;
  imageUrl?: string; // Optional field for image posts
  likes: Types.ObjectId[]; // Array of User ObjectIds who liked the post
  comments: IComment[]; // Array of comment subdocuments
  createdAt: Date;
  updatedAt: Date;
}

// Define the Mongoose schema for Comments (as a subdocument)
const CommentSchema: Schema<IComment> = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } } // Only need createdAt for comments
);

// Define the Mongoose schema for Posts
const PostSchema: Schema<IPost> = new Schema(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: "User", // Creates a reference to the User model
      required: true,
      index: true, // Indexing author can speed up queries for user-specific posts
    },
    content: {
      type: String,
      required: [true, "Post content cannot be empty"],
      trim: true,
      maxlength: [280, "Post content cannot exceed 280 characters"], // Twitter-like limit
    },
    imageUrl: {
      type: String, // URL to an image (we'll handle uploads later)
    },
    likes: [{ type: Schema.Types.ObjectId, ref: "User" }], // Array of references to Users
    comments: [CommentSchema], // Embed the Comment schema as an array of subdocuments
  },
  {
    timestamps: true, // Automatically add createdAt and updatedAt fields
  }
);

// Prevent mongoose from recompiling the model if it already exists
const Post: Model<IPost> = models.Post || mongoose.model<IPost>("Post", PostSchema);

export default Post;
