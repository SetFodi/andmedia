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
    // Basic pagination (optional, but good practice)
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    // Fetch posts, sorted by newest first
    // Populate 'author' field to get username and profile picture
    const posts = await Post.find({})
      .populate<{ author: Pick<IPost["author"], "username" | "profilePicture"> }>(
        "author", // Field to populate
        "username profilePicture" // Select specific fields from the User model
      )
      .sort({ createdAt: -1 }) // Sort by creation date, descending
      .skip(skip)
      .limit(limit)
      .lean(); // Use .lean() for faster read-only operations

    // Get total count for pagination metadata (optional)
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

// --- POST Handler: Create Post ---
export async function POST(request: NextRequest) {
    console.log("\n--- Handling POST /api/posts ---"); // Mark start of request handling
    await dbConnect();
  
    // 1. Log Secret and Cookies
    const currentSecret = process.env.NEXTAUTH_SECRET;
    console.log(
      "API /api/posts - Using Secret:",
      currentSecret ? currentSecret.substring(0, 3) + "..." : "UNDEFINED"
    );
  
    const cookieHeader = request.headers.get("cookie");
    console.log("API /api/posts - Received Cookie Header:", cookieHeader);
    // Specifically check for the expected cookie name
    const sessionCookie = cookieHeader
      ?.split("; ")
      .find((c) => c.startsWith("next-auth.session-token="));
    console.log("API /api/posts - Found session cookie:", !!sessionCookie);
  
  
    // 2. Check Authentication
    let token = null;
    let getTokenError = null;
    try {
        token = await getToken({
            req: request,
            secret: currentSecret,
            // Optional: Add logging for debugging getToken itself
            // log: (code, ...message) => {
            //   console.log(`getToken log [${code}]:`, ...message);
            // },
        });
    } catch (error) {
        console.error("API /api/posts - Error calling getToken:", error);
        getTokenError = error;
    }
  
    console.log("API /api/posts - Token received from getToken:", token);
  
  
    // 3. Authentication Check Logic
    if (getTokenError) {
        return NextResponse.json(
            { success: false, message: "Error reading authentication token." },
            { status: 500 }
        );
    }
  
    if (!token) {
      console.error("API /api/posts - Authentication failed: Token is null/undefined.");
      return NextResponse.json(
        { success: false, message: "Unauthorized: Invalid session (token null)" },
        { status: 401 }
      );
    }
  
    // Explicitly check for the 'id' property we added in the jwt callback
    if (!token.id) {
        console.error("API /api/posts - Authentication failed: Token is missing 'id' property.", token);
        return NextResponse.json(
            { success: false, message: "Unauthorized: Invalid session (missing id)" },
            { status: 401 }
        );
    }
  
    // --- If authentication passed ---
    console.log("API /api/posts - Authentication successful. User ID:", token.id);
  
    try {
      const { content, imageUrl } = await request.json();
      const authorId = token.id as string; // Get user ID from the token
  
      // ... (rest of your existing validation, post creation, etc.) ...
  
      // 2. Validate Input
      if (!content || content.trim().length === 0) {
        return NextResponse.json(
          { success: false, message: "Post content cannot be empty" },
          { status: 400 }
        );
      }
      if (content.length > 280) {
        // Match schema validation
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
  
      // 5. Populate author info
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
      console.error("API /api/posts - Error during post creation logic:", error);
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