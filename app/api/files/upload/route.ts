// app/api/files/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
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
    console.log("File Upload API: Creating new MongoClient promise");
    const client = new MongoClient(MONGODB_URI!);
    clientPromise = client.connect().catch((err) => {
      clientPromise = null;
      console.error("File Upload API: Initial connection failed", err);
      throw err;
    });
  }
  try {
    const client = await clientPromise;
    const url = new URL(MONGODB_URI!);
    const dbNameFromUri = url.pathname.substring(1).split("?")[0];
    const dbName = dbNameFromUri || "test";
    return client.db(dbName);
  } catch (error) {
    console.error("❌ File Upload API: Failed to get DB instance:", error);
    clientPromise = null;
    throw error;
  }
}
// --- End Database Connection Caching ---

// --- POST Handler ---
export async function POST(request: NextRequest) {
  // 1. Authenticate User (Optional but recommended for tracking/permissions)
  const token = await getToken({ req: request, secret });
  if (!token || !token.id) {
    // Allow anonymous uploads? Or enforce login? Let's enforce for now.
    return NextResponse.json(
      { success: false, message: "Unauthorized: Must be logged in to upload files" },
      { status: 401 }
    );
  }
  const userId = token.id as string; // For metadata

  try {
    const database = await getDb();
    const bucket = new GridFSBucket(database, { bucketName: "uploads" });

    // 2. Parse FormData
    const formData = await request.formData();
    // Use a generic field name like 'file'
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "No file uploaded." },
        { status: 400 }
      );
    }

    // 3. Validation (Example: Image type and size)
    if (!file.type.startsWith("image/")) {
        return NextResponse.json(
            { success: false, message: "Invalid file type. Only images allowed." },
            { status: 400 }
        );
    }
    const maxSizeMB = 10; // Example: 10MB limit
    if (file.size > maxSizeMB * 1024 * 1024) {
        return NextResponse.json(
            { success: false, message: `File size exceeds ${maxSizeMB}MB limit.` },
            { status: 400 }
        );
    }

    // 4. Prepare file data for GridFS
    const filename =
      crypto.randomBytes(16).toString("hex") + path.extname(file.name);
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // 5. Stream Buffer to GridFS
    const uploadStream = bucket.openUploadStream(filename, {
      contentType: file.type,
      metadata: { uploaderId: userId }, // Store who uploaded it
    });
    await new Promise<void>((resolve, reject) => {
      const readableStream = new Readable();
      readableStream._read = () => {};
      readableStream.push(fileBuffer);
      readableStream.push(null);
      readableStream
        .pipe(uploadStream)
        .on("error", (error) => reject(error))
        .on("finish", () => resolve());
    });

    console.log(`File Upload API: File ${filename} uploaded by ${userId}`);

    // 6. Construct the URL to access the file
    const fileUrl = `/api/files/${filename}`;

    // 7. Return the URL
    return NextResponse.json(
      {
        success: true,
        message: "File uploaded successfully",
        data: { fileUrl: fileUrl }, // Return the relative URL
      },
      { status: 201 } // 201 Created
    );
  } catch (error: any) {
    console.error(`File Upload API: Error for user ${token?.id}:`, error);
    return NextResponse.json(
      { success: false, message: error.message || "Internal Server Error during upload" },
      { status: 500 }
    );
  }
}
