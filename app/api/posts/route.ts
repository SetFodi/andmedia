// app/api/posts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import dbConnect from "@/lib/dbConnect";
import Post, { IPost } from "@/models/Post";
import User from "@/models/User"; // Import User model for population

const secret = process.env.NEXTAUTH_SECRET;

// --- GET Handler: Fetch Posts ---
export async function GET(request: NextRequest) {
  await dbConnect();

  try {
    // Basic pagination
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    // Fetch posts, sorted by newest first, populate author
    const posts = await Post.find({})
      .populate<{ author: Pick<IPost["author"], "username" | "profilePicture"> }>(
        "author",
        "username profilePicture"
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalPosts = await Post.countDocuments();

    return NextResponse.json(
      {
        success: true,
        message: "Posts fetched successfully",
        data: posts,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalPosts / limit),
          totalPosts: totalPosts,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error fetching posts:", error);
    return NextResponse.json(
      { success: false, message: "Error fetching posts" },
      { status: 500 }
    );
  }
}

// --- POST Handler: Create Post (Cleaned Logs) ---
export async function POST(request: NextRequest) {
  await dbConnect();

  // 1. Check Authentication
  const token = await getToken({ req: request, secret });
  if (!token || !token.id) {
    // Log only the failure case now
    console.error("API /api/posts - POST failed: Unauthorized. Token:", token);
    return NextResponse.json(
      { success: false, message: "Unauthorized: User not logged in" },
      { status: 401 }
    );
  }

  // If authentication passed:
  console.log("API /api/posts - User authenticated:", token.id);

  try {
    const { content, imageUrl } = await request.json();
    const authorId = token.id as string;

    // 2. Validate Input
    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { success: false, message: "Post content cannot be empty" },
        { status: 400 }
      );
    }
    if (content.length > 280) {
      return NextResponse.json(
        {
          success: false,
          message: "Post content cannot exceed 280 characters",
        },
        { status: 400 }
      );
    }

    // 3. Create New Post
    const newPost = new Post({
      author: authorId,
      content: content.trim(),
      imageUrl: imageUrl || undefined,
      likes: [],
      comments: [],
    });

    // 4. Save Post
    await newPost.save();
    console.log(`API /api/posts - Post created by ${authorId}`);


    // 5. Populate author info for the response
    const populatedPost = await Post.findById(newPost._id)
      .populate<{ author: Pick<IPost["author"], "username" | "profilePicture"> }>(
        "author",
        "username profilePicture"
      )
      .lean();

    return NextResponse.json(
      {
        success: true,
        message: "Post created successfully",
        data: populatedPost,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error(`API /api/posts - Error during post creation by ${token.id}:`, error);
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err: any) => err.message);
      return NextResponse.json(
        { success: false, message: messages.join(", ") },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: "Error creating post" },
      { status: 500 }
    );
  }
}
