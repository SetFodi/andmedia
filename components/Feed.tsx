// components/Feed.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import PostItem from "./PostItem";
import { IPost } from "@/models/Post"; // Import the base IPost type

// Define the shape of the post data expected from the API (with populated author)
type PopulatedPost = Omit<IPost, "author" | "likes"> & {
  _id: string;
  author: {
    _id: string;
    username: string;
    profilePicture?: string;
  };
  likes: string[]; // Array of user IDs
};

const Feed: React.FC = () => {
  const [posts, setPosts] = useState<PopulatedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true); // To know if more posts can be loaded
  const limit = 10; // Posts per page

  // Function to fetch posts
  const fetchPosts = useCallback(
    async (pageNum: number, loadMore = false) => {
      if (!loadMore) {
        // If not loading more (initial load or refresh), show loading state
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
          setHasMore(newPosts.length === limit); // If we received less than limit, no more posts
        } else {
          setError(response.data.message || "Failed to fetch posts.");
          setHasMore(false);
        }
      } catch (err: any) {
        console.error("Error fetching posts:", err);
        setError(
          err.response?.data?.message || "An error occurred while fetching posts."
        );
        setHasMore(false); // Stop trying to load more on error
      } finally {
        setIsLoading(false);
      }
    },
    [limit]
  ); // Dependency array includes limit

  // Initial fetch on component mount
  useEffect(() => {
    fetchPosts(1);
  }, [fetchPosts]); // fetchPosts is memoized by useCallback

  // Function to handle loading more posts
  const loadMorePosts = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPosts(nextPage, true); // Pass true for loadMore
  };

  // Function to refresh the feed (fetch page 1 again)
  // This will be passed to CreatePostForm
  const refreshFeed = useCallback(() => {
    setPage(1); // Reset to page 1
    setPosts([]); // Optionally clear existing posts immediately for better UX
    setHasMore(true); // Assume there might be posts again
    fetchPosts(1);
  }, [fetchPosts]);

  // --- Render Logic ---

  if (isLoading && page === 1) {
    // Show initial loading state only on first load
    return (
      <div className="mt-8 text-center text-gray-500">Loading posts...</div>
    );
  }

  if (error && posts.length === 0) {
    // Show error only if there are no posts to display
    return (
      <div className="mt-8 rounded border border-red-200 bg-red-50 p-4 text-center text-red-700">
        Error loading feed: {error}
        <button
          onClick={refreshFeed}
          className="ml-2 text-sm font-semibold text-red-800 underline"
        >
          Retry
        </button>
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
      {/* Pass refreshFeed to the CreatePostForm */}
      {/* We'll add this in the HomePage component where Feed is rendered */}

      {/* List of Posts */}
      {posts.map((post) => (
        // Ensure post has a unique _id before rendering
        post._id ? <PostItem key={post._id} post={post} /> : null
      ))}

      {/* Error message during load more */}
      {error && posts.length > 0 && (
         <p className="text-center text-sm text-red-600">Error loading more posts: {error}</p>
      )}

      {/* Load More Button */}
      {hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMorePosts}
            disabled={isLoading} // Disable button while loading more
            className="rounded-full bg-gray-100 px-5 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Loading..." : "Load More"}
          </button>
        </div>
      )}

      {!hasMore && posts.length > 0 && (
         <p className="mt-6 text-center text-sm text-gray-500">You've reached the end!</p>
      )}
    </div>
  );
};

// We need a wrapper component to pass the refreshFeed function
// from Feed down to CreatePostForm when they are used together.
// Let's integrate them in the HomePage instead.

export default Feed; // Export Feed directly for now
