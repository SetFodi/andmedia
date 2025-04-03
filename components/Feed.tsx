// components/Feed.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import PostItem from "./PostItem";
import { IPost } from "@/models/Post";
import { useSocket } from "@/context/SocketContext"; // Import useSocket
import { PopulatedUser, PopulatedComment } from "./PostItem"; // Import types

// Define the shape of the post data expected from the API/Socket
// Export this type if CreatePostForm needs it
export type PopulatedPost = Omit<IPost, "author" | "likes" | "comments"> & {
  _id: string;
  author: PopulatedUser;
  likes: string[];
  comments: PopulatedComment[];
};

// --- Add refreshFeed prop interface ---
interface FeedProps {
    refreshFeed: () => void; // Function to trigger a refresh in HomePage
}
// --- End Add ---

const Feed: React.FC<FeedProps> = ({ refreshFeed }) => { // Destructure refreshFeed prop
  const [posts, setPosts] = useState<PopulatedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const limit = 10;

  const { socket, isConnected } = useSocket(); // Get socket instance and connection status

  // Function to fetch posts
  const fetchPosts = useCallback(
    async (pageNum: number, loadMore = false) => {
      if (!loadMore) {
        setIsLoading(true);
      }
      setError(null);

      try {
        const response = await axios.get("/api/posts", {
          params: { page: pageNum, limit },
        });

        if (response.data.success) {
          const newPosts = response.data.data as PopulatedPost[];
          setPosts((prevPosts) =>
            loadMore ? [...prevPosts, ...newPosts] : newPosts
          );
          setHasMore(newPosts.length === limit);
        } else {
          setError(response.data.message || "Failed to fetch posts.");
          setHasMore(false);
        }
      } catch (err: any) {
        console.error("Error fetching posts:", err);
        setError(
          err.response?.data?.message || "An error occurred while fetching posts."
        );
        setHasMore(false);
      } finally {
        // Only stop initial loading indicator
        if (!loadMore) {
            setIsLoading(false);
        }
      }
    },
    [limit]
  );

  // Initial fetch on component mount
  useEffect(() => {
    fetchPosts(1);
  }, [fetchPosts]); // Note: fetchPosts depends on limit, which is stable.

  // --- Socket Listeners ---
  useEffect(() => {
    if (!socket || !isConnected) {
      // console.log("Feed: Socket not connected, listeners not attached.");
      return; // Don't attach listener if socket is not ready
    }

    // Listener for New Posts
    const handleNewPost = (newPost: PopulatedPost) => {
      console.log("Feed: handleNewPost function CALLED with data:", newPost?._id);
      setPosts((prevPosts) => {
        if (prevPosts.some((post) => post._id === newPost._id)) {
          return prevPosts;
        }
        console.log(`Feed: Adding new post ${newPost._id} to state.`);
        return [newPost, ...prevPosts];
      });
    };

    // --- Listener for Deleted Posts ---
    const handlePostDeleted = (data: { postId: string }) => {
        if (data && data.postId) {
            console.log(`Feed: Received 'post_deleted' event for ID: ${data.postId}`);
            // Remove the post from the state by filtering
            setPosts((prevPosts) => prevPosts.filter(post => {
                // console.log(`Filtering: Comparing post._id (${post._id}) with data.postId (${data.postId})`);
                return post._id !== data.postId;
            }));
        } else {
            console.warn("Feed: Received invalid 'post_deleted' data:", data);
        }
    };
    // --- End Listener for Deleted Posts ---

    console.log("Feed: Attaching 'post_created' listener");
    socket.on("post_created", handleNewPost);
    console.log("Feed: Attaching 'post_deleted' listener"); // Log attachment
    socket.on("post_deleted", handlePostDeleted); // Attach listener

    // Cleanup listeners
    return () => {
      console.log("Feed: Detaching 'post_created' listener");
      socket.off("post_created", handleNewPost);
      console.log("Feed: Detaching 'post_deleted' listener"); // Log detachment
      socket.off("post_deleted", handlePostDeleted); // Detach listener
    };
  }, [socket, isConnected]); // Dependencies

  // Function to handle loading more posts
  const loadMorePosts = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPosts(nextPage, true); // Pass true for loadMore
  };

  // --- Render Logic ---

  if (isLoading && page === 1) {
    return (
      <div className="mt-8 text-center text-gray-500">Loading posts...</div>
    );
  }

  if (error && posts.length === 0) {
    return (
      <div className="mt-8 rounded border border-red-200 bg-red-50 p-4 text-center text-red-700">
        Error loading feed: {error}
      </div>
    );
  }

  if (!isLoading && posts.length === 0) {
    return (
      <div className="mt-8 text-center text-gray-500">
        No posts yet. Be the first!
      </div>
    );
  }

  return (
    <div className="mt-6 w-full max-w-2xl">
      {/* List of Posts */}
      {posts.map((post) =>
        post._id ? (
            // --- Pass refreshFeed down to PostItem as onPostDeleted ---
            <PostItem key={post._id} post={post} onPostDeleted={refreshFeed} />
            // --- End Pass ---
        ) : null
      )}

      {/* Error message during load more */}
      {error && posts.length > 0 && (
        <p className="text-center text-sm text-red-600">
          Error loading more posts: {error}
        </p>
      )}

      {/* Load More Button */}
      {hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMorePosts}
            // Consider adding a loading state specific to loadMore
            // disabled={isLoadingMore}
            className="rounded-full bg-gray-100 px-5 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Load More {/* Change text if isLoadingMore state exists */}
          </button>
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <p className="mt-6 text-center text-sm text-gray-500">
          You've reached the end!
        </p>
      )}
    </div>
  );
};

export default Feed;
