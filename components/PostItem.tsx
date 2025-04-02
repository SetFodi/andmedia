// components/PostItem.tsx
import React from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { IPost } from "@/models/Post"; // Assuming IPost includes populated author

// Define the expected shape of the populated author within the post prop
interface PopulatedAuthor {
  _id: string;
  username: string;
  profilePicture?: string;
}

// Define the props for PostItem, ensuring author is populated
interface PostItemProps {
  post: Omit<IPost, "author" | "likes"> & {
    author: PopulatedAuthor;
    likes: string[]; // Assuming likes are just IDs for now
    _id: string; // Ensure _id is available
  };
}

const PostItem: React.FC<PostItemProps> = ({ post }) => {
  // Fallback for missing author data (should ideally not happen with population)
  const authorUsername = post.author?.username ?? "Unknown User";
  const authorProfilePic =
    post.author?.profilePicture ?? "/default-avatar.png"; // Use your default avatar path

  // Format timestamp
  const timeAgo = post.createdAt
    ? formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })
    : "Timestamp unavailable";

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-shadow duration-200 ease-in-out hover:shadow-md">
      <div className="mb-3 flex items-center space-x-3">
        {/* Author Avatar */}
        <Image
          src={authorProfilePic}
          alt={`${authorUsername}'s avatar`}
          width={40}
          height={40}
          className="rounded-full object-cover"
          unoptimized // Add this if using relative paths like /default-avatar.png without a loader configured
        />
        {/* Author Info */}
        <div>
          <p className="font-semibold text-gray-900">{authorUsername}</p>
          <p className="text-xs text-gray-500">{timeAgo}</p>
        </div>
      </div>

      {/* Post Content */}
      <p className="mb-3 whitespace-pre-wrap text-gray-800">{post.content}</p>

      {/* Optional Image */}
      {post.imageUrl && (
        <div className="mb-3 overflow-hidden rounded-lg border border-gray-200">
          <Image
            src={post.imageUrl}
            alt="Post image"
            width={500} // Adjust as needed, consider aspect ratio
            height={300} // Adjust as needed
            className="h-auto w-full object-cover"
            // Add loader configuration if using external image URLs in production
          />
        </div>
      )}

      {/* Action Buttons (Placeholder) */}
      <div className="flex items-center justify-between text-gray-500">
        <button className="flex items-center space-x-1 rounded p-1 hover:bg-gray-100 hover:text-gray-700">
          {/* Like Icon (replace with actual icon later) */}
          <span>❤️</span>
          <span className="text-sm">{post.likes?.length ?? 0}</span>
        </button>
        <button className="flex items-center space-x-1 rounded p-1 hover:bg-gray-100 hover:text-gray-700">
          {/* Comment Icon (replace with actual icon later) */}
          <span>💬</span>
          <span className="text-sm">{post.comments?.length ?? 0}</span>
        </button>
        {/* Add Share/More buttons later */}
      </div>
    </div>
  );
};

export default PostItem;
