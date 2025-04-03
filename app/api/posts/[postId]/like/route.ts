// app/api/posts/[postId]/like/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import dbConnect from "@/lib/dbConnect";
import Post from "@/models/Post";
import mongoose from "mongoose";
// Removed Socket.IO imports as they are no longer used here

const secret = process.env.NEXTAUTH_SECRET;

interface RouteContext {
  params: {
    postId: string;
  };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { postId } = context.params;
  await dbConnect();

  // 1. Authenticate User
  const token = await getToken({ req: request, secret });
  if (!token || !token.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  const userId = token.id as string;

  // 2. Validate Post ID
  if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
    console.error(`Like API: Invalid Post ID received: ${postId}`);
    return NextResponse.json({ success: false, message: "Invalid Post ID" }, { status: 400 });
  }

  try {
    // 3. Find the Post
    const post = await Post.findById(postId);
    if (!post) {
      return NextResponse.json({ success: false, message: "Post not found" }, { status: 404 });
    }

    // 4. Check if user already liked the post
    const likesAsString = post.likes.map((id) => id.toString());
    const hasLiked = likesAsString.includes(userId);

    let updateOperation;
    if (hasLiked) {
      // User has liked, so unlike (remove user ID from likes)
      updateOperation = { $pull: { likes: userId } };
    } else {
      // User hasn't liked, so like (add user ID to likes)
      updateOperation = { $addToSet: { likes: userId } };
    }

    // 5. Update Likes Array
    const updatedPost = await Post.findByIdAndUpdate(
      postId,
      updateOperation,
      { new: true } // Return the updated document
    ).lean(); // Use lean for the response object

    if (!updatedPost) {
      return NextResponse.json({ success: false, message: "Failed to update post likes" }, { status: 500 });
    }

    // --- Socket Emit Section REMOVED ---

    // 6. Return Response
    const message = hasLiked ? "Post unliked successfully" : "Post liked successfully";
    console.log(`Like API: User ${userId} ${hasLiked ? 'unliked' : 'liked'} post ${postId}`);
    return NextResponse.json(
      {
        success: true,
        message: message,
        // Send back the updated likes array in the response as well
        data: { likes: updatedPost.likes.map(id => id.toString()) },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error(`Like API: Error liking/unliking post ${postId}:`, error);
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}
