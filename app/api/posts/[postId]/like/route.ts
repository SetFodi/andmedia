// app/api/posts/[postId]/like/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import dbConnect from "@/lib/dbConnect";
import Post from "@/models/Post";
import mongoose from "mongoose";

const secret = process.env.NEXTAUTH_SECRET;

// Define the context type explicitly for clarity
interface RouteContext {
  params: {
    postId: string;
  };
}

// Use the standard (request, context) signature
export async function PATCH(request: NextRequest, context: RouteContext) {
  // Access postId from the context object's params property
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

  // 2. Validate Post ID (using postId derived from context)
  if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
    console.error(`Like API: Invalid Post ID received: ${postId}`);
    return NextResponse.json(
      { success: false, message: "Invalid Post ID" },
      { status: 400 }
    );
  }

  try {
    // 3. Find the Post
    const post = await Post.findById(postId);
    if (!post) {
      return NextResponse.json(
        { success: false, message: "Post not found" },
        { status: 404 }
      );
    }

    // 4. Check if user already liked the post
    const likesAsString = post.likes.map((id) => id.toString());
    const hasLiked = likesAsString.includes(userId);

    let updatedPost;

    // 5. Update Likes Array
    if (hasLiked) {
      // Unlike
      updatedPost = await Post.findByIdAndUpdate(
        postId,
        { $pull: { likes: userId } },
        { new: true }
      )
        .populate<{ author: { username: string; profilePicture?: string } }>(
          "author",
          "username profilePicture"
        )
        .lean();
      console.log(`Like API: User ${userId} unliked post ${postId}`);
    } else {
      // Like
      updatedPost = await Post.findByIdAndUpdate(
        postId,
        { $addToSet: { likes: userId } },
        { new: true }
      )
        .populate<{ author: { username: string; profilePicture?: string } }>(
          "author",
          "username profilePicture"
        )
        .lean();
      console.log(`Like API: User ${userId} liked post ${postId}`);
    }

    if (!updatedPost) {
      return NextResponse.json(
        { success: false, message: "Failed to update post likes" },
        { status: 500 }
      );
    }

    // 6. Return Response
    return NextResponse.json(
      {
        success: true,
        message: hasLiked ? "Post unliked successfully" : "Post liked successfully",
        data: updatedPost,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error(`Like API: Error liking/unliking post ${postId}:`, error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
