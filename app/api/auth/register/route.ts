// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";

export async function POST(request: NextRequest) {
  await dbConnect();

  try {
    const { username, email, password } = await request.json();

    // --- Input Validation ---
    if (!username || !email || !password) {
      return NextResponse.json(
        { success: false, message: "Missing required fields" },
        { status: 400 }
      );
    }

    // Basic email format check (consider a more robust library for production)
    if (!/.+\@.+\..+/.test(email)) {
      return NextResponse.json(
        { success: false, message: "Invalid email format" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        {
          success: false,
          message: "Password must be at least 6 characters long",
        },
        { status: 400 }
      );
    }
    // --- End Input Validation ---

    // --- Check for existing user ---
    const existingUserByEmail = await User.findOne({
      email: email.toLowerCase(),
    });
    if (existingUserByEmail) {
      return NextResponse.json(
        { success: false, message: "Email already exists" },
        { status: 409 } // 409 Conflict
      );
    }

    const existingUserByUsername = await User.findOne({
      username: username.toLowerCase(),
    });
    if (existingUserByUsername) {
      return NextResponse.json(
        { success: false, message: "Username already exists" },
        { status: 409 } // 409 Conflict
      );
    }
    // --- End Check ---

    // --- Hash Password ---
    const hashedPassword = await bcrypt.hash(password, 10); // Salt rounds = 10
    // --- End Hash Password ---

    // --- Create New User ---
    const newUser = new User({
      username: username.toLowerCase(), // Store lowercase for consistency
      email: email.toLowerCase(),
      password: hashedPassword,
      // Add default values or leave optional fields empty as defined in the schema
      // profilePicture: '/default-avatar.png', // Example if you want to set it here
    });

    await newUser.save();
    // --- End Create New User ---

    console.log("User registered successfully:", newUser.email);

    // Don't return the password hash in the response
    const userResponse = {
      _id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      createdAt: newUser.createdAt,
    };

    return NextResponse.json(
      {
        success: true,
        message: "User registered successfully",
        user: userResponse,
      },
      { status: 201 } // 201 Created
    );
  } catch (error: any) {
    console.error("Registration error:", error);

    // Handle potential Mongoose validation errors
    if (error.name === "ValidationError") {
      // Extract meaningful messages from Mongoose validation errors
      const messages = Object.values(error.errors).map((err: any) => err.message);
      return NextResponse.json(
        { success: false, message: messages.join(", ") },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, message: "An internal server error occurred" },
      { status: 500 }
    );
  }
}
