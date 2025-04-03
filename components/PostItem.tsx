// components/PostItem.tsx
"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { IPost, IComment } from "@/models/Post";
import axios from "axios";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useSocket } from "@/context/SocketContext"; // Import useSocket

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
    likes: string[]; // Expecting likes as an array of user IDs (strings) initially
    comments: PopulatedComment[];
  };
}

// --- Single Comment Component (Complete - No changes needed) ---
const CommentItem: React.FC<{ comment: PopulatedComment }> = ({ comment }) => {
  const authorUsername = comment.user?.username ?? "Unknown User";
  const authorProfilePic =
    comment.user?.profilePicture ?? "/default-avatar.png";
  const timeAgo = comment.createdAt
    ? formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })
    : "";

  return (
    <div className="flex space-x-3 pt-3 first:pt-0">
      <Image
        src={authorProfilePic}
        alt={`${authorUsername}'s avatar`}
        width={32}
        height={32}
        className="mt-1 h-8 w-8 flex-shrink-0 rounded-full object-cover"
        unoptimized
      />
      <div className="flex-1 text-sm">
        <div className="flex items-baseline space-x-2">
          <Link
            href={`/profile/${authorUsername}`}
            className="font-semibold text-gray-800 hover:underline"
          >
            {authorUsername}
          </Link>
          <span className="text-xs text-gray-500">{timeAgo}</span>
        </div>
        <p className="mt-1 whitespace-pre-wrap text-gray-700">
          {comment.text}
        </p>
      </div>
    </div>
  );
};

// --- Main Post Item Component (Complete - Modified Like Handler & Listener) ---
const PostItem: React.FC<PostItemProps> = ({ post }) => {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const { socket, isConnected } = useSocket(); // Get socket

  // Like State - Initialize from props
  const [isLiked, setIsLiked] = useState(() =>
    currentUserId ? post.likes.includes(currentUserId) : false
  );
  const [likeCount, setLikeCount] = useState(post.likes?.length ?? 0);
  const [isLoadingLike, setIsLoadingLike] = useState(false);

  // Comment State
  const [comments, setComments] = useState<PopulatedComment[]>(post.comments ?? []);
  const [commentText, setCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);

  // Effect to update like state based on props
  useEffect(() => {
    setLikeCount(post.likes?.length ?? 0);
    setIsLiked(currentUserId ? post.likes.includes(currentUserId) : false);
  }, [post.likes, currentUserId]);

  // Effect for Comments
  useEffect(() => {
    setComments(post.comments ?? []);
  }, [post.comments]);

  // --- Socket Listener for Like Updates (Broadcasted from Server) ---
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleLikeUpdate = (data: { postId: string; likes: string[] }) => {
      if (data.postId === post._id) {
        console.log(`PostItem (${post._id}): Received broadcast 'like_updated'`, data);
        setLikeCount(data.likes.length);
        setIsLiked(currentUserId ? data.likes.includes(currentUserId) : false);
      }
    };

    console.log(`PostItem (${post._id}): Attaching 'like_updated' listener`);
    socket.on("like_updated", handleLikeUpdate);

    return () => {
      console.log(`PostItem (${post._id}): Detaching 'like_updated' listener`);
      socket.off("like_updated", handleLikeUpdate);
    };
  }, [socket, isConnected, post._id, currentUserId]);

  // Author/Time details
  const authorUsername = post.author?.username ?? "Unknown User";
  const authorProfilePic = post.author?.profilePicture ?? "/default-avatar.png";
  const timeAgo = post.createdAt ? formatDistanceToNow(new Date(post.createdAt), { addSuffix: true }) : "Timestamp unavailable";

  // --- Like Handler (Emits event from client on success) ---
  const handleLikeClick = async () => {
    if (!currentUserId || isLoadingLike) {
      if (!currentUserId) console.log("Please log in to like posts.");
      return;
    }
    setIsLoadingLike(true);

    try {
      const response = await axios.patch(`/api/posts/${post._id}/like`);

      if (response.data.success) {
        console.log("Like API call successful for user click");
        const updatedLikes = response.data.data.likes as string[];
        const payload = { postId: post._id, likes: updatedLikes };

        // Update local state immediately for the user who clicked
        setLikeCount(updatedLikes.length);
        setIsLiked(currentUserId ? updatedLikes.includes(currentUserId) : false);

        // --- Emit event for other clients via server ---
        if (socket && isConnected) { // Check connection status too
            console.log(`PostItem (${post._id}): Emitting 'like_updated_from_client'`, payload);
            socket.emit("like_updated_from_client", payload);
        } else {
            console.warn(`PostItem (${post._id}): Socket not available or connected, cannot emit like update.`);
        }
        // --- End Emit ---

      } else {
        console.error("Failed to update like status via API:", response.data.message);
        // Optional: Show error to user. Don't revert state here, rely on potential future socket events.
      }
    } catch (error) {
      console.error("Error calling like API:", error);
      // Optional: Show error to user
    } finally {
      setIsLoadingLike(false);
    }
  };

  // --- Comment Submit Handler (Complete) ---
  const handleCommentSubmit = async (event: React.FormEvent) => {
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

  // --- Render Logic (Complete) ---
  return (
    <div className="mb-4 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow duration-200 ease-in-out hover:shadow-md">
      {/* Post Header */}
      <div className="flex items-center space-x-3 p-4">
        <Image src={authorProfilePic} alt={`${authorUsername}'s avatar`} width={40} height={40} className="h-10 w-10 flex-shrink-0 rounded-full object-cover" unoptimized />
        <div className="flex flex-col">
          <Link href={`/profile/${authorUsername}`} className="font-semibold text-gray-900 hover:underline">
            {authorUsername}
          </Link>
          <p className="text-xs text-gray-500">{timeAgo}</p>
        </div>
      </div>

      {/* Post Content */}
      {post.content && ( <p className="whitespace-pre-wrap px-4 pb-3 text-gray-800">{post.content}</p> )}

      {/* Optional Image */}
      {post.imageUrl && ( <div className="border-y border-gray-100 bg-gray-50"><Image src={post.imageUrl} alt="Post image" width={600} height={400} className="h-auto w-full object-cover" /></div> )}

      {/* Action Buttons & Counts */}
      <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2 text-gray-500">
        {/* Like Button */}
        <button
          onClick={handleLikeClick}
          disabled={isLoadingLike || !currentUserId}
          className={`flex items-center space-x-1 rounded p-1 transition-colors duration-150 ease-in-out focus:outline-none focus:ring-1 focus:ring-pink-400 focus:ring-offset-1 disabled:cursor-not-allowed ${ isLiked ? "text-pink-600 hover:bg-pink-50" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700" }`}
          aria-pressed={isLiked}
          aria-label={isLiked ? "Unlike post" : "Like post"}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" className={`h-5 w-5 ${isLiked ? "fill-pink-600" : "fill-none"}`} stroke={isLiked ? "none" : "currentColor"} strokeWidth={isLiked ? 0 : 1.5} >
            <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
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
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5" >
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </svg>
          <span className="text-sm font-medium">{comments.length}</span>
        </button>
      </div>

      {/* Comment Section */}
      {showComments && (
        <div className="border-t border-gray-200 bg-gray-50 px-4 pb-4 pt-3">
          {/* Comment Input Form */}
          {currentUserId && (
            <form onSubmit={handleCommentSubmit} className="mb-4 flex items-center space-x-2">
              <Image src={session?.user?.image ?? "/default-avatar.png"} alt="Your avatar" width={32} height={32} className="h-8 w-8 flex-shrink-0 rounded-full object-cover" unoptimized />
              <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Write a comment..." className="flex-1 rounded-full border border-gray-300 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" disabled={isSubmittingComment} maxLength={500} />
              <button type="submit" disabled={isSubmittingComment || !commentText.trim()} className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" >
                {isSubmittingComment ? "..." : "Post"}
              </button>
            </form>
          )}
          {commentError && ( <p className="mb-2 text-center text-xs text-red-600">{commentError}</p> )}
          {/* List of Comments */}
          <div className="max-h-60 overflow-y-auto">
            {comments.length > 0 ? (
              comments.map((comment) => ( <CommentItem key={comment._id} comment={comment} /> ))
            ) : (
              <p className="py-4 text-center text-sm text-gray-500">No comments yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PostItem;
