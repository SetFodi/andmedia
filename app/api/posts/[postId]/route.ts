// app/api/posts/[postId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import dbConnect from "@/lib/dbConnect";
import Post from "@/models/Post";
import User from "@/models/User"; // Needed if we check comments/likes later
import mongoose from "mongoose";
import { GridFSBucket, MongoClient, Db, ObjectId } from "mongodb"; // Import GridFSBucket & ObjectId

const secret = process.env.NEXTAUTH_SECRET;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "Please define the MONGODB_URI environment variable inside .env.local"
  );
}

// --- Database Connection Caching for GridFS ---
let clientPromise: Promise<MongoClient> | null = null;
async function getDb(): Promise<Db> {
    // ... (Use the same getDb function as in file upload/serve routes) ...
    if (!clientPromise) {
        console.log("Delete Post API: Creating new MongoClient promise for GridFS");
        const client = new MongoClient(MONGODB_URI!);
        clientPromise = client.connect().catch((err) => {
        clientPromise = null;
        console.error("Delete Post API: GridFS connection failed", err);
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
        console.error("❌ Delete Post API: Failed to get DB instance for GridFS:", error);
        clientPromise = null;
        throw error;
    }
}
// --- End Database Connection Caching ---


interface RouteContext {
  params: {
    postId: string;
  };
}

// --- DELETE Handler ---
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { postId } = context.params;
  await dbConnect(); // Connect Mongoose

  // 1. Authenticate User
  const token = await getToken({ req: request, secret });
  if (!token || !token.id) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  const userId = token.id as string;

  // 2. Validate Post ID
  if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
    return NextResponse.json({ success: false, message: "Invalid Post ID" }, { status: 400 });
  }

  try {
    // 3. Find the Post
    const post = await Post.findById(postId);
    if (!post) {
      return NextResponse.json({ success: false, message: "Post not found" }, { status: 404 });
    }

    // 4. Authorize Deletion (User must be the author)
    if (post.author.toString() !== userId) {
      return NextResponse.json({ success: false, message: "Forbidden: You can only delete your own posts" }, { status: 403 });
    }

    // 5. Delete Post from Database
    await Post.findByIdAndDelete(postId);
    console.log(`Post Deleted: Post ${postId} deleted by user ${userId}`);

    // 6. Delete Associated Image from GridFS (if exists)
    if (post.imageUrl && post.imageUrl.startsWith("/api/files/")) {
      const filename = post.imageUrl.split("/").pop(); // Extract filename from URL
      if (filename) {
        try {
          const database = await getDb(); // Get DB connection for GridFS
          const bucket = new GridFSBucket(database, { bucketName: "uploads" });

          // Find the file ID in fs.files
          const files = await bucket.find({ filename }).limit(1).toArray();
          if (files && files.length > 0) {
            const fileId = files[0]._id as ObjectId; // Get the ObjectId
            await bucket.delete(fileId);
            console.log(`GridFS Delete: Deleted image ${filename} (ID: ${fileId}) for post ${postId}`);
          } else {
            console.warn(`GridFS Delete: Image file ${filename} not found for post ${postId}`);
          }
        } catch (gridFsError) {
          // Log GridFS error but don't necessarily fail the whole request
          // The post is deleted, which is the main goal. Orphaned files can be cleaned up later.
          console.error(`GridFS Delete Error for post ${postId}, file ${filename}:`, gridFsError);
        }
      }
    }

    // --- Socket Emit logic will be handled by the client ---

    // 7. Return Success Response
    return NextResponse.json(
      {
        success: true,
        message: "Post deleted successfully",
        data: { postId: postId } // Return the ID of the deleted post
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error(`Delete Post API: Error deleting post ${postId}:`, error);
    return NextResponse.json({ success: false, message: "Internal Server Error" }, { status: 500 });
  }
}

// Add other handlers (GET, PATCH) if they exist in this file
