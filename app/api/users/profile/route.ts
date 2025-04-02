// app/api/users/profile/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import mongoose from "mongoose";

const secret = process.env.NEXTAUTH_SECRET;

// Using PATCH as we are partially updating the user resource
export async function PATCH(request: NextRequest) {
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

  try {
    // 2. Get data from request body
    const { name, bio } = await request.json();

    // 3. Prepare update object (only include fields that are provided)
    const updateData: { name?: string; bio?: string } = {};
    if (name !== undefined) {
      // Allow empty string for name, but trim whitespace
      updateData.name = typeof name === 'string' ? name.trim() : '';
    }
    if (bio !== undefined) {
      // Allow empty string for bio, trim, and validate length
      const trimmedBio = typeof bio === 'string' ? bio.trim() : '';
      if (trimmedBio.length > 160) { // Match schema validation
          return NextResponse.json(
              { success: false, message: "Bio cannot exceed 160 characters" },
              { status: 400 }
          );
      }
      updateData.bio = trimmedBio;
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
            { success: false, message: "No update data provided" },
            { status: 400 }
        );
    }

    // 4. Find user and update
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData }, // Use $set to update only provided fields
      { new: true, runValidators: true } // Return updated doc, run schema validators
    ).select("name bio username profilePicture"); // Select fields needed for response/session update

    if (!updatedUser) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    console.log(`Profile updated for user ${userId}`);

    // 5. Return updated profile data (partial)
    return NextResponse.json(
      {
        success: true,
        message: "Profile updated successfully",
        data: updatedUser, // Send back the updated fields
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error(`Profile Update API: Error for user ${userId}:`, error);
     if (error.name === "ValidationError") {
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
