// app/profile/[username]/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import Image from "next/image";
import PostItem from "@/components/PostItem";
import { IPost } from "@/models/Post";
import { PopulatedUser, PopulatedComment } from "@/components/PostItem";
import { useSession } from "next-auth/react"; // Import useSession

// Define the structure of the post data expected within the profile response
type ProfilePost = Omit<IPost, "author" | "likes" | "comments"> & {
  _id: string;
  author: PopulatedUser;
  likes: string[];
  comments: PopulatedComment[];
};

// Define the structure of the profile data expected from the API
interface ProfileData {
  _id: string;
  username: string;
  name?: string;
  bio?: string;
  profilePicture?: string;
  followersCount: number;
  followingCount: number;
  createdAt: string;
  posts: ProfilePost[];
  // We need to know if the *logged-in* user is following this profile
  // This will be determined client-side for now
}

export default function ProfilePage() {
  const params = useParams();
  const username = params?.username as string;
  const { data: session } = useSession(); // Get current user session
  const currentUserId = session?.user?.id;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for follow button
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  // State to track follower count changes locally
  const [localFollowersCount, setLocalFollowersCount] = useState(0);

  // Function to check initial follow status (client-side)
  // This requires fetching the *current user's* data, which might be inefficient.
  // A better approach long-term might be to include 'isFollowing' in the profile API response
  // if the request is authenticated. For now, we'll do a basic check if needed,
  // but rely more on the button action itself.
  // Let's skip the initial check for now and determine status based on button clicks
  // and potentially add it later if needed.

  const fetchProfile = useCallback(async () => {
    if (!username) {
      setError("Username not found in URL.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setProfile(null);

    try {
      const response = await axios.get(`/api/users/${username}`);
      if (response.data.success) {
        setProfile(response.data.data);
        setLocalFollowersCount(response.data.data.followersCount); // Initialize local count

        // TODO: Implement check if current user is following this profile
        // This would ideally come from the API or require another fetch
        // For now, we assume 'false' initially if not the user's own profile
        setIsFollowing(false); // Placeholder - needs proper check
      } else {
        setError(response.data.message || "Failed to load profile.");
      }
    } catch (err: any) {
      console.error("Error fetching profile:", err);
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setError("User not found.");
      } else {
        setError("An error occurred while fetching the profile.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [username]); // Dependency on username

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]); // Fetch profile on mount and when fetchProfile changes (username)

  // --- Follow/Unfollow Handler ---
  const handleFollowToggle = async () => {
    if (!currentUserId || isFollowLoading || !profile) {
      if (!currentUserId) console.log("Please log in to follow users.");
      return;
    }

    setIsFollowLoading(true);

    // --- Optimistic UI Update ---
    const previousIsFollowing = isFollowing;
    const previousFollowersCount = localFollowersCount;

    setIsFollowing(!isFollowing);
    setLocalFollowersCount((prevCount) =>
      isFollowing ? prevCount - 1 : prevCount + 1
    );
    // --- End Optimistic Update ---

    try {
      const response = await axios.post(`/api/users/${profile.username}/follow`);

      if (!response.data.success) {
        // Revert optimistic update on API failure
        console.error("Failed to follow/unfollow:", response.data.message);
        setIsFollowing(previousIsFollowing);
        setLocalFollowersCount(previousFollowersCount);
      } else {
        console.log("Follow status updated successfully");
        // API call was successful, optimistic state is correct
        // Optionally, refetch profile to get exact counts, but optimistic is usually fine
        // fetchProfile(); // Uncomment to refetch for absolute accuracy
      }
    } catch (error) {
      console.error("Error calling follow API:", error);
      // Revert optimistic update on network/server error
      setIsFollowing(previousIsFollowing);
      setLocalFollowersCount(previousFollowersCount);
    } finally {
      setIsFollowLoading(false);
    }
  };

  // --- Render Logic ---
  if (isLoading) {
    // ... loading state ...
    return (
      <div className="flex min-h-screen items-center justify-center p-4 pt-20">
        <p className="text-lg text-gray-600">Loading profile...</p>
      </div>
    );
  }
  if (error) {
    // ... error state ...
     return (
      <div className="flex min-h-screen items-center justify-center p-4 pt-20">
        <div className="rounded border border-red-200 bg-red-50 p-6 text-center text-red-700">
          <p className="font-semibold">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }
  if (!profile) {
    // ... no profile state ...
     return (
      <div className="flex min-h-screen items-center justify-center p-4 pt-20">
        <p className="text-lg text-gray-600">Profile data unavailable.</p>
      </div>
    );
  }

  const profilePic = profile.profilePicture ?? "/default-avatar.png";
  const memberSince = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
      })
    : "Unknown";

  // Determine if the profile being viewed belongs to the logged-in user
  const isOwnProfile = currentUserId === profile._id;

  return (
    <div className="min-h-screen bg-gray-50 p-4 pt-20">
      <div className="mx-auto max-w-3xl">
        {/* Profile Header */}
        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col items-center sm:flex-row sm:items-start sm:space-x-6">
            {/* Avatar */}
            <Image
              src={profilePic}
              alt={`${profile.username}'s avatar`}
              width={128}
              height={128}
              className="h-32 w-32 flex-shrink-0 rounded-full object-cover ring-4 ring-white"
              unoptimized
            />
            {/* Profile Info */}
            <div className="mt-4 flex flex-grow flex-col items-center text-center sm:mt-0 sm:items-start sm:text-left">
              <div className="flex w-full items-center justify-between"> {/* Container for name and button */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {profile.name || profile.username}
                    </h1>
                    <p className="text-md text-gray-500">@{profile.username}</p>
                </div>
                {/* --- Follow/Edit Button --- */}
                {currentUserId && ( // Only show button if logged in
                    <div className="mt-2 sm:mt-0">
                    {isOwnProfile ? (
                        <button className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                        Edit Profile
                        </button>
                    ) : (
                        <button
                        onClick={handleFollowToggle}
                        disabled={isFollowLoading}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 ${
                            isFollowing
                            ? "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-400" // Unfollow style
                            : "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500" // Follow style
                        }`}
                        >
                        {isFollowLoading
                            ? "..."
                            : isFollowing
                            ? "Unfollow"
                            : "Follow"}
                        </button>
                    )}
                    </div>
                )}
              </div>


              {/* Follow Stats */}
              <div className="mt-3 flex space-x-4 text-sm text-gray-600">
                <span>
                  <span className="font-semibold text-gray-900">
                    {profile.posts?.length ?? 0}
                  </span>{" "}
                  Posts
                </span>
                <span>
                  <span className="font-semibold text-gray-900">
                    {localFollowersCount} {/* Use local state */}
                  </span>{" "}
                  Followers
                </span>
                <span>
                  <span className="font-semibold text-gray-900">
                    {profile.followingCount}
                  </span>{" "}
                  Following
                </span>
              </div>

              {/* Bio */}
              {profile.bio && (
                <p className="mt-3 text-sm text-gray-700">{profile.bio}</p>
              )}

              {/* Member Since */}
              <p className="mt-3 text-xs text-gray-400">
                Joined {memberSince}
              </p>
            </div>
          </div>
        </div>

        {/* User's Posts Feed */}
        {/* ... (keep existing posts feed section) ... */}
         <h2 className="mb-4 text-xl font-semibold text-gray-800">Posts</h2>
        <div className="space-y-4">
          {profile.posts && profile.posts.length > 0 ? (
            profile.posts.map((post) => (
              <PostItem key={post._id} post={post as any} />
            ))
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-500 shadow-sm">
              <p>@{profile.username} hasn't posted anything yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
