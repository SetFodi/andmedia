// app/api/files/[filename]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { MongoClient, GridFSBucket, Db } from "mongodb";
import { Readable } from "stream";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "Please define the MONGODB_URI environment variable inside .env.local"
  );
}

// --- Database Connection Caching ---
// Cache the MongoClient connection promise globally
let clientPromise: Promise<MongoClient> | null = null;

async function getDb(): Promise<Db> {
  if (!clientPromise) {
    console.log("File Server: Creating new MongoClient promise");
    const client = new MongoClient(MONGODB_URI!);
    // Store the promise, not the resolved client
    clientPromise = client.connect().catch((err) => {
      // If connection fails, reset the promise to allow retries
      clientPromise = null;
      console.error("File Server: Initial connection failed", err);
      throw err; // Re-throw error
    });
  } else {
    // console.log("File Server: Reusing existing MongoClient promise");
  }

  try {
    const client = await clientPromise; // Wait for the connection promise to resolve
    // Extract DB name from URI if present, otherwise let driver decide/use default 'test'
    const url = new URL(MONGODB_URI!);
    // Remove leading '/' and query params/options
    const dbNameFromUri = url.pathname.substring(1).split("?")[0];
    const dbName = dbNameFromUri || "test"; // Fallback to 'test' if not in URI
    // console.log(`File Server: Using DB: ${dbName}`);
    return client.db(dbName); // Get the Db instance
  } catch (error) {
    console.error("❌ File Server: Failed to get DB instance:", error);
    // Reset promise if resolving failed after initial connection seemed okay
    clientPromise = null;
    throw error; // Rethrow error to be caught by the handler
  }
}
// --- End Database Connection Caching ---

interface RouteContext {
  params: {
    filename: string;
  };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { filename } = context.params;

  if (!filename) {
    return new NextResponse("Filename parameter is required", { status: 400 });
  }

  try {
    const database = await getDb(); // Use the improved connection helper
    const bucket = new GridFSBucket(database, {
      bucketName: "uploads", // Must match the bucketName used during upload
    });

    // Find the file metadata
    // Use limit(1) for efficiency as we only need one file
    const files = await bucket.find({ filename }).limit(1).toArray();
    if (!files || files.length === 0) {
      console.log(`GridFS GET: File not found - ${filename}`);
      return new NextResponse("File not found", { status: 404 });
    }

    const file = files[0]; // Get the first match

    // Open a download stream from GridFS
    const downloadStream = bucket.openDownloadStreamByName(filename);

    // Set appropriate headers for image display
    const headers = new Headers();
    headers.set("Content-Type", file.contentType || "application/octet-stream");
    // Omit Content-Length for streams, browser will handle it
    headers.set("Cache-Control", "public, max-age=31536000, immutable"); // Add strong caching

    // Use ReadableStream from Node.js 'stream' to wrap the GridFS stream
    const nodeReadable = Readable.from(downloadStream);

    downloadStream.on("error", (error) => {
      console.error(`GridFS download stream error for ${filename}:`, error);
      // Cannot return NextResponse here as headers might be sent
    });

    // Return the stream as the response body
    return new NextResponse(nodeReadable as any, { // Cast needed for type compatibility
      status: 200,
      headers: headers,
    });
  } catch (error: any) {
    console.error(`Error serving file ${filename}:`, error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
