// app/api/users/[username]/follow/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import mongoose from "mongoose";

const secret = process.env.NEXTAUTH_SECRET;

interface RouteContext {
  params: {
    username: string; // The username of the user to follow/unfollow
  };
}

// Using POST for this action, as it changes the state of relationships
export async function POST(request: NextRequest, context: RouteContext) {
  const { username: targetUsername } = context.params;
  await dbConnect();

  // 1. Authenticate the current user (the one performing the action)
  const token = await getToken({ req: request, secret });
  if (!token || !token.id) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }
  const currentUserId = token.id as string;

  // 2. Validate target username
  if (!targetUsername) {
    return NextResponse.json(
      { success: false, message: "Target username is required" },
      { status: 400 }
    );
  }

  try {
    // 3. Find the target user to follow/unfollow
    const targetUser = await User.findOne({
      username: targetUsername.toLowerCase(),
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, message: "Target user not found" },
        { status: 404 }
      );
    }

    // 4. Prevent self-following
    if (targetUser._id.toString() === currentUserId) {
      return NextResponse.json(
        { success: false, message: "You cannot follow yourself" },
        { status: 400 }
      );
    }

    // 5. Find the current user (to update their 'following' list)
    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      // Should not happen if token is valid, but good practice
      return NextResponse.json(
        { success: false, message: "Current user not found" },
        { status: 404 }
      );
    }

    // 6. Determine if already following
    const isFollowing = currentUser.following.some(
      (id) => id.toString() === targetUser._id.toString()
    );

    let updateCurrentUser;
    let updateTargetUser;
    let message: string;

    // 7. Perform Follow/Unfollow database updates
    if (isFollowing) {
      // --- Unfollow ---
      updateCurrentUser = User.findByIdAndUpdate(
        currentUserId,
        { $pull: { following: targetUser._id } },
        { new: true } // Optional: return updated doc if needed later
      );
      updateTargetUser = User.findByIdAndUpdate(
        targetUser._id,
        { $pull: { followers: currentUserId } },
        { new: true } // Optional: return updated doc if needed later
      );
      message = "User unfollowed successfully";
      console.log(`Follow API: User ${currentUserId} unfollowed ${targetUser._id}`);
    } else {
      // --- Follow ---
      updateCurrentUser = User.findByIdAndUpdate(
        currentUserId,
        { $addToSet: { following: targetUser._id } }, // Use $addToSet to prevent duplicates
        { new: true }
      );
      updateTargetUser = User.findByIdAndUpdate(
        targetUser._id,
        { $addToSet: { followers: currentUserId } }, // Use $addToSet to prevent duplicates
        { new: true }
      );
      message = "User followed successfully";
      console.log(`Follow API: User ${currentUserId} followed ${targetUser._id}`);
    }

    // Execute both updates concurrently
    await Promise.all([updateCurrentUser, updateTargetUser]);

    // 8. Return success response
    return NextResponse.json(
      {
        success: true,
        message: message,
        // Optionally return updated follow status or counts if needed
        // isFollowing: !isFollowing // The new follow status
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error(
      `Follow API: Error following/unfollowing ${targetUsername} by ${currentUserId}:`,
      error
    );
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
