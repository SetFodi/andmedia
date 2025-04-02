// components/PostItem.tsx
"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { IPost, IComment } from "@/models/Post";
import axios from "axios";
import { useSession } from "next-auth/react";
import Link from "next/link";

// Define the expected shape of the populated author/user
interface PopulatedUser {
  _id: string;
  username: string;
  profilePicture?: string;
}

// Define the shape of a comment with a populated user
type PopulatedComment = Omit<IComment, "user"> & {
  _id: string;
  user: PopulatedUser;
};

// Define the props for PostItem, ensuring author and comments.user are populated
interface PostItemProps {
  post: Omit<IPost, "author" | "likes" | "comments"> & {
    _id: string;
    author: PopulatedUser;
    likes: string[];
    comments: PopulatedComment[];
  };
}

// --- Single Comment Component ---
const CommentItem: React.FC<{ comment: PopulatedComment }> = ({ comment }) => {
  const authorUsername = comment.user?.username ?? "Unknown User";
  const authorProfilePic =
    comment.user?.profilePicture ?? "/default-avatar.png";
  const timeAgo = comment.createdAt
    ? formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })
    : "";

  return (
    // Use flexbox for layout
    <div className="flex space-x-3 pt-3 first:pt-0">
      <Image
        src={authorProfilePic}
        alt={`${authorUsername}'s avatar`}
        width={32}
        height={32}
        className="mt-1 h-8 w-8 flex-shrink-0 rounded-full object-cover" // Added mt-1 for slight alignment adjustment
        unoptimized
      />
      <div className="flex-1 text-sm">
        {/* Container for username and time */}
        <div className="flex items-baseline space-x-2">
          <Link href={`/profile/${authorUsername}`} legacyBehavior>
            <a className="font-semibold text-gray-800 hover:underline">
              {authorUsername}
            </a>
          </Link>
          <span className="text-xs text-gray-500">{timeAgo}</span>
        </div>
        {/* Comment text below */}
        <p className="mt-1 whitespace-pre-wrap text-gray-700">
          {comment.text}
        </p>
      </div>
    </div>
  );
};

// --- Main Post Item Component ---
const PostItem: React.FC<PostItemProps> = ({ post }) => {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;

  // Like State
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes?.length ?? 0);
  const [isLoadingLike, setIsLoadingLike] = useState(false);

  // Comment State
  const [comments, setComments] = useState<PopulatedComment[]>(post.comments ?? []);
  const [commentText, setCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);

  // Effect for Likes
  useEffect(() => {
    if (currentUserId && post.likes) {
      setIsLiked(post.likes.includes(currentUserId));
    } else {
      setIsLiked(false);
    }
    setLikeCount(post.likes?.length ?? 0);
  }, [post.likes, currentUserId]);

  // Effect for Comments
  useEffect(() => {
    setComments(post.comments ?? []);
  }, [post.comments]);

  // Author/Time details
  const authorUsername = post.author?.username ?? "Unknown User";
  const authorProfilePic =
    post.author?.profilePicture ?? "/default-avatar.png";
  const timeAgo = post.createdAt
    ? formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })
    : "Timestamp unavailable";

  // --- Like Handler ---
  const handleLikeClick = async () => {
    // ... (keep existing like handler code) ...
    if (!currentUserId || isLoadingLike) {
      if (!currentUserId) console.log("Please log in to like posts.");
      return;
    }
    setIsLoadingLike(true);
    const previousIsLiked = isLiked;
    const previousLikeCount = likeCount;
    setIsLiked(!isLiked);
    setLikeCount((prevCount) => (isLiked ? prevCount - 1 : prevCount + 1));

    try {
      const response = await axios.patch(`/api/posts/${post._id}/like`);
      if (!response.data.success) {
        console.error("Failed to update like status:", response.data.message);
        setIsLiked(previousIsLiked);
        setLikeCount(previousLikeCount);
      } else {
        setLikeCount(response.data.data.likes.length);
        setIsLiked(response.data.data.likes.includes(currentUserId));
        console.log("Like status updated successfully");
      }
    } catch (error) {
      console.error("Error calling like API:", error);
      setIsLiked(previousIsLiked);
      setLikeCount(previousLikeCount);
    } finally {
      setIsLoadingLike(false);
    }
  };

  // --- Comment Submit Handler ---
  const handleCommentSubmit = async (event: React.FormEvent) => {
    // ... (keep existing comment handler code) ...
    event.preventDefault();
    if (!commentText.trim() || isSubmittingComment || !currentUserId) {
      if (!currentUserId) setCommentError("Please log in to comment.");
      return;
    }
    setIsSubmittingComment(true);
    setCommentError(null);

    try {
      const response = await axios.post(`/api/posts/${post._id}/comments`, {
        text: commentText.trim(),
      });
      if (response.data.success) {
        const newComment = response.data.data as PopulatedComment;
        setComments((prevComments) => [newComment, ...prevComments]);
        setCommentText("");
        setShowComments(true);
      } else {
        setCommentError(response.data.message || "Failed to add comment.");
      }
    } catch (err: any) {
      console.error("Error submitting comment:", err);
      setCommentError(
        err.response?.data?.message || "An error occurred while commenting."
      );
    } finally {
      setIsSubmittingComment(false);
    }
  };

  return (
    <div className="mb-4 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow duration-200 ease-in-out hover:shadow-md">
      {/* --- Post Header --- */}
      <div className="flex items-center space-x-3 p-4"> {/* Use flex for alignment */}
        <Image
          src={authorProfilePic}
          alt={`${authorUsername}'s avatar`}
          width={40}
          height={40}
          className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
          unoptimized
        />
        {/* Div to hold username and timestamp vertically */}
        <div className="flex flex-col">
          <Link href={`/profile/${authorUsername}`} legacyBehavior>
            <a className="font-semibold text-gray-900 hover:underline">
              {authorUsername}
            </a>
          </Link>
          <p className="text-xs text-gray-500">{timeAgo}</p>
        </div>
      </div>

      {/* --- Post Content --- */}
      {post.content && (
         <p className="whitespace-pre-wrap px-4 pb-3 text-gray-800">
           {post.content}
         </p>
      )}

      {/* --- Optional Image --- */}
      {post.imageUrl && (
        <div className="border-y border-gray-100 bg-gray-50">
          <Image
            src={post.imageUrl}
            alt="Post image"
            width={600}
            height={400}
            className="h-auto w-full object-cover"
          />
        </div>
      )}

      {/* --- Action Buttons & Counts --- */}
      <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2 text-gray-500"> {/* Added border-t */}
        {/* Like Button */}
        <button
          onClick={handleLikeClick}
          disabled={isLoadingLike || !currentUserId}
          className={`flex items-center space-x-1 rounded p-1 transition-colors duration-150 ease-in-out focus:outline-none focus:ring-1 focus:ring-pink-400 focus:ring-offset-1 disabled:cursor-not-allowed ${
            isLiked
              ? "text-pink-600 hover:bg-pink-50"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          }`}
          aria-pressed={isLiked}
          aria-label={isLiked ? "Unlike post" : "Like post"}
        >
          {/* Heart SVG */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            className={`h-5 w-5 ${isLiked ? "fill-pink-600" : "fill-none"}`}
            stroke={isLiked ? "none" : "currentColor"}
            strokeWidth={isLiked ? 0 : 1.5}
          >
            <path
              fillRule="evenodd"
              d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm font-medium">{likeCount}</span>
        </button>

        {/* Comment Button */}
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center space-x-1 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:ring-offset-1"
          aria-expanded={showComments}
          aria-label="Toggle comments"
        >
          {/* Comment SVG */}
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
          <span className="text-sm font-medium">{comments.length}</span>
        </button>
      </div>

      {/* --- Comment Section (Conditionally Rendered) --- */}
      {showComments && (
        <div className="border-t border-gray-200 bg-gray-50 px-4 pb-4 pt-3">
          {/* Comment Input Form */}
          {currentUserId && (
            // Use flex and items-center for vertical alignment
            <form onSubmit={handleCommentSubmit} className="mb-4 flex items-center space-x-2">
              <Image
                src={session?.user?.image ?? "/default-avatar.png"}
                alt="Your avatar"
                width={32}
                height={32}
                className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
                unoptimized
              />
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 rounded-full border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                disabled={isSubmittingComment}
                maxLength={500}
              />
              <button
                type="submit"
                disabled={isSubmittingComment || !commentText.trim()}
                className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmittingComment ? "..." : "Post"}
              </button>
            </form>
          )}
          {commentError && (
            <p className="mb-2 text-center text-xs text-red-600">{commentError}</p>
          )}

          {/* List of Comments */}
          {/* Use border-t on CommentItem instead of space-y */}
          <div className="max-h-60 overflow-y-auto">
            {comments.length > 0 ? (
              comments.map((comment) => (
                <CommentItem key={comment._id} comment={comment} />
              ))
            ) : (
              <p className="py-4 text-center text-sm text-gray-500">
                No comments yet.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PostItem;
