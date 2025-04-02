// app/api/posts/[postId]/comments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import dbConnect from "@/lib/dbConnect";
import Post, { IComment } from "@/models/Post";
import User from "@/models/User"; // Import User model
import mongoose from "mongoose";

const secret = process.env.NEXTAUTH_SECRET;

interface RouteContext {
  params: {
    postId: string;
  };
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { postId } = context.params;
  await dbConnect();

  // 1. Authenticate User
  const token = await getToken({ req: request, secret });
  if (!token || !token.id) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }
  const userId = token.id as string;

  // 2. Validate Post ID
  if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
    return NextResponse.json(
      { success: false, message: "Invalid Post ID" },
      { status: 400 }
    );
  }

  try {
    // 3. Get Comment Text from Body
    const { text } = await request.json();
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: "Comment text cannot be empty" },
        { status: 400 }
      );
    }
    if (text.length > 500) {
      // Match schema validation
      return NextResponse.json(
        {
          success: false,
          message: "Comment cannot exceed 500 characters",
        },
        { status: 400 }
      );
    }

    // 4. Create Comment Subdocument Object
    const newComment = {
      user: userId, // Store the user's ObjectId
      text: text.trim(),
      // createdAt will be added automatically by the subdocument schema
    };

    // 5. Find Post and Push Comment
    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      {
        $push: {
          comments: {
            $each: [newComment], // Use $each to add the object
            $sort: { createdAt: -1 }, // Optional: Keep comments sorted by newest
          },
        },
      },
      { new: true } // Return the updated document
    );

    if (!updatedPost) {
      return NextResponse.json(
        { success: false, message: "Post not found or failed to add comment" },
        { status: 404 }
      );
    }

    // 6. Find the newly added comment to populate its user for the response
    // The newly added comment should be the first one if sorted by descending createdAt
    const addedComment = updatedPost.comments[0];

    // Manually populate the user for the single comment response
    await User.populate(addedComment, {
      path: "user",
      select: "username profilePicture",
    });

    console.log(`Comment API: User ${userId} commented on post ${postId}`);

    // 7. Return the newly added comment (with populated user)
    return NextResponse.json(
      {
        success: true,
        message: "Comment added successfully",
        data: addedComment, // Send back just the new comment object
      },
      { status: 201 } // 201 Created
    );
  } catch (error: any) {
    console.error(`Comment API: Error adding comment to post ${postId}:`, error);
    if (error.name === "ValidationError") {
      // Mongoose validation errors on the comment subdocument
      const messages = Object.values(error.errors).map((err: any) => err.message);
      return NextResponse.json(
        { success: false, message: messages.join(", ") },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
