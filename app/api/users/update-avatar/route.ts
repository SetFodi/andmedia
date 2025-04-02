// app/api/users/update-avatar/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import dbConnect from "@/lib/dbConnect"; // Keep for Mongoose User model
import User from "@/models/User";
import mongoose from "mongoose";
import { GridFSBucket, MongoClient, Db } from "mongodb";
import crypto from "crypto";
import path from "path";
import { Readable } from "stream";

const secret = process.env.NEXTAUTH_SECRET;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "Please define the MONGODB_URI environment variable inside .env.local"
  );
}

// --- Database Connection Caching (Use the same pattern) ---
let clientPromise: Promise<MongoClient> | null = null;

async function getDb(): Promise<Db> {
  if (!clientPromise) {
    console.log("Avatar Upload: Creating new MongoClient promise");
    const client = new MongoClient(MONGODB_URI!);
    clientPromise = client.connect().catch((err) => {
      clientPromise = null;
      console.error("Avatar Upload: Initial connection failed", err);
      throw err;
    });
  } else {
    // console.log("Avatar Upload: Reusing existing MongoClient promise");
  }

  try {
    const client = await clientPromise;
    const url = new URL(MONGODB_URI!);
    const dbNameFromUri = url.pathname.substring(1).split("?")[0];
    const dbName = dbNameFromUri || "test";
    // console.log(`Avatar Upload: Using DB: ${dbName}`);
    return client.db(dbName);
  } catch (error) {
    console.error("❌ Avatar Upload: Failed to get DB instance:", error);
    clientPromise = null;
    throw error;
  }
}
// --- End Database Connection Caching ---

// --- POST Handler ---
export async function POST(request: NextRequest) {
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
    const database = await getDb(); // Use the improved connection helper for GridFS
    const bucket = new GridFSBucket(database, { bucketName: "uploads" });

    // 2. Parse FormData
    const formData = await request.formData();
    const file = formData.get("avatar") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "No avatar file uploaded." },
        { status: 400 }
      );
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, message: "Invalid file type. Only images allowed." },
        { status: 400 }
      );
    }
    if (file.size > 10 * 1024 * 1024) { // 10MB limit example
      return NextResponse.json(
        { success: false, message: "File size exceeds 10MB limit." },
        { status: 400 }
      );
    }

    // 3. Prepare file data for GridFS
    const filename =
      crypto.randomBytes(16).toString("hex") + path.extname(file.name);
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // 4. Stream Buffer to GridFS
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: file.type,
      metadata: { userId: userId },
    });
    await new Promise<void>((resolve, reject) => {
      const readableStream = new Readable();
      readableStream._read = () => {};
      readableStream.push(fileBuffer);
      readableStream.push(null);
      readableStream
        .pipe(uploadStream)
        .on("error", (error) => {
          console.error("GridFS upload stream error:", error);
          reject(new Error("Failed to upload file to storage."));
        })
        .on("finish", () => {
          console.log(`GridFS: File ${filename} uploaded successfully.`);
          resolve();
        });
    });

    // 5. Construct the URL
    const fileUrl = `/api/files/${filename}`;

    // 6. Update User's profilePicture URL (Use Mongoose connection here)
    await dbConnect(); // Connect Mongoose
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePicture: fileUrl },
      { new: true }
    ).lean();

    if (!updatedUser) {
      // TODO: Consider deleting the file from GridFS
      return NextResponse.json(
        { success: false, message: "User not found after upload." },
        { status: 404 }
      );
    }

    console.log(`Avatar updated for user ${userId} to ${fileUrl}`);

    // 7. Return the new URL
    return NextResponse.json(
      {
        success: true,
        message: "Avatar updated successfully",
        data: { profilePictureUrl: fileUrl },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error(`Avatar Upload API: Error for user ${userId}:`, error);
    return NextResponse.json(
      { success: false, message: error.message || "Internal Server Error during upload" },
      { status: 500 }
    );
  }
}
