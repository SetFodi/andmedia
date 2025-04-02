// components/PostItem.tsx
"use client"; // Need client component for state, effects, and onClick

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { IPost } from "@/models/Post";
import axios from "axios";
import { useSession } from "next-auth/react"; // Import useSession

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
    likes: string[]; // Expecting likes as an array of user IDs (strings)
    _id: string; // Ensure _id is available
  };
}

const PostItem: React.FC<PostItemProps> = ({ post }) => {
  const { data: session } = useSession(); // Get session data
  const currentUserId = session?.user?.id; // Get current logged-in user's ID

  // State for like status and count
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes?.length ?? 0);
  const [isLoadingLike, setIsLoadingLike] = useState(false);

  // Determine initial like state when component mounts or post/user changes
  useEffect(() => {
    if (currentUserId && post.likes) {
      setIsLiked(post.likes.includes(currentUserId));
    } else {
      setIsLiked(false); // Not liked if no user or no likes array
    }
    // Update like count based on initial props
    setLikeCount(post.likes?.length ?? 0);
  }, [post.likes, currentUserId]); // Re-run if likes array or user changes

  // Fallback for missing author data
  const authorUsername = post.author?.username ?? "Unknown User";
  const authorProfilePic =
    post.author?.profilePicture ?? "/default-avatar.png";

  // Format timestamp
  const timeAgo = post.createdAt
    ? formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })
    : "Timestamp unavailable";

  // Handle Like Button Click
  const handleLikeClick = async () => {
    if (!currentUserId || isLoadingLike) {
      // Optionally redirect to login or show message if not logged in
      if (!currentUserId) console.log("Please log in to like posts.");
      return;
    }

    setIsLoadingLike(true);

    // --- Optimistic UI Update ---
    const previousIsLiked = isLiked;
    const previousLikeCount = likeCount;

    setIsLiked(!isLiked); // Toggle like state immediately
    setLikeCount((prevCount) => (isLiked ? prevCount - 1 : prevCount + 1)); // Adjust count immediately
    // --- End Optimistic Update ---

    try {
      // Call the API endpoint
      const response = await axios.patch(`/api/posts/${post._id}/like`);

      if (!response.data.success) {
        // Revert optimistic update on API failure
        console.error("Failed to update like status:", response.data.message);
        setIsLiked(previousIsLiked);
        setLikeCount(previousLikeCount);
      } else {
        // Optional: Update state with data from response if needed,
        // but optimistic update usually covers it.
        // setLikeCount(response.data.data.likes.length);
        // setIsLiked(response.data.data.likes.includes(currentUserId));
        console.log("Like status updated successfully");
      }
    } catch (error) {
      console.error("Error calling like API:", error);
      // Revert optimistic update on network/server error
      setIsLiked(previousIsLiked);
      setLikeCount(previousLikeCount);
    } finally {
      setIsLoadingLike(false);
    }
  };

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
          unoptimized
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
            width={500}
            height={300}
            className="h-auto w-full object-cover"
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between text-gray-500">
        <button
          onClick={handleLikeClick}
          disabled={isLoadingLike || !currentUserId} // Disable if loading or not logged in
          className={`flex items-center space-x-1 rounded p-1 transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-pink-300 focus:ring-offset-1 disabled:cursor-not-allowed ${
            isLiked
              ? "text-pink-600 hover:bg-pink-50"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          }`}
          aria-pressed={isLiked} // Accessibility
          aria-label={isLiked ? "Unlike post" : "Like post"}
        >
          {/* Like Icon (Conditional Fill) */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={`h-5 w-5 ${isLiked ? "fill-pink-600" : "fill-none"}`}
            stroke={isLiked ? "none" : "currentColor"} // Use stroke for outline
            strokeWidth={isLiked ? 0 : 1.5} // Adjust stroke width as needed
          >
            <path
              fillRule="evenodd"
              d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
              clipRule="evenodd"
            />
          </svg>

          <span className="text-sm">{likeCount}</span>
        </button>
        <button className="flex items-center space-x-1 rounded p-1 hover:bg-gray-100 hover:text-gray-700">
          {/* Comment Icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
            />
          </svg>
          <span className="text-sm">{post.comments?.length ?? 0}</span>
        </button>
        {/* Add Share/More buttons later */}
      </div>
    </div>
  );
};

export default PostItem;
