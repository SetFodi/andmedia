// app/api/users/[username]/route.ts
import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User, { IUser } from "@/models/User";
import Post, { IPost } from "@/models/Post"; // Import Post and IPost
import mongoose from "mongoose";

// Define types for populated fields for clarity
type PopulatedPostAuthor = Pick<IUser, "username" | "profilePicture">;
type PopulatedCommentUser = Pick<IUser, "username" | "profilePicture">;

interface RouteContext {
  params: {
    username: string;
  };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { username } = context.params;
  await dbConnect();

  if (!username) {
    return NextResponse.json(
      { success: false, message: "Username parameter is required" },
      { status: 400 }
    );
  }

  try {
    // 1. Find the User by username (case-insensitive)
    const user = await User.findOne({
      username: username.toLowerCase(),
    }).lean(); // Use lean for the user profile data

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    // 2. Fetch the User's Posts
    // Basic pagination for posts (optional, add later if needed)
    const userPosts = await Post.find({ author: user._id }) // Find posts by this user's ID
      .populate<{ author: PopulatedPostAuthor }>(
        "author",
        "username profilePicture"
      )
      .populate<{ comments: (IComment & { user: PopulatedCommentUser })[] }>({
        path: "comments.user",
        select: "username profilePicture",
        model: User,
      })
      .sort({ createdAt: -1 })
      .limit(20) // Limit the number of posts initially loaded
      .lean();

    // 3. Prepare the response data
    // Exclude sensitive fields like email if not needed on public profile
    const profileData = {
      _id: user._id.toString(),
      username: user.username,
      name: user.name,
      bio: user.bio,
      profilePicture: user.profilePicture,
      followersCount: user.followers?.length ?? 0,
      followingCount: user.following?.length ?? 0,
      createdAt: user.createdAt,
      posts: userPosts, // Include the user's posts
    };

    return NextResponse.json(
      {
        success: true,
        message: "User profile fetched successfully",
        data: profileData,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error(`Error fetching profile for ${username}:`, error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
