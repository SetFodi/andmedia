// app/profile/[username]/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef } from "react"; // Added useRef
import { useParams } from "next/navigation"; // Hook to get dynamic route params
import axios from "axios";
import Image from "next/image";
import PostItem from "@/components/PostItem"; // Reuse the PostItem component
import { IPost } from "@/models/Post"; // Import base types if needed for casting
import { PopulatedUser, PopulatedComment } from "@/components/PostItem"; // Import types from PostItem
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
  createdAt: string; // Assuming it comes as string from JSON
  posts: ProfilePost[];
}

export default function ProfilePage() {
  const params = useParams(); // Get route parameters { username: '...' }
  const username = params?.username as string; // Extract username, assert as string
  const { data: session, update: updateSession } = useSession(); // Get session and update function
  const currentUserId = session?.user?.id;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for follow button
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [localFollowersCount, setLocalFollowersCount] = useState(0);

  // State for avatar upload
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for hidden file input

  const fetchProfile = useCallback(async () => {
    if (!username) {
      setError("Username not found in URL.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setProfile(null); // Clear previous profile data

    try {
      const response = await axios.get(`/api/users/${username}`);
      if (response.data.success) {
        const fetchedProfile = response.data.data as ProfileData;
        setProfile(fetchedProfile);
        setLocalFollowersCount(fetchedProfile.followersCount); // Initialize local count

        // Placeholder for checking follow status - ideally API driven
        // For now, assume false unless it's the user's own profile
        setIsFollowing(false);
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

    // Optimistic UI Update
    const previousIsFollowing = isFollowing;
    const previousFollowersCount = localFollowersCount;
    setIsFollowing(!isFollowing);
    setLocalFollowersCount((prevCount) =>
      isFollowing ? prevCount - 1 : prevCount + 1
    );

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

  // --- Avatar Upload Handlers ---
  const handleAvatarClick = () => {
    // Trigger hidden file input only on own profile
    if (isOwnProfile) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile) return;

    // Reset errors and set loading state
    setUploadError(null);
    setIsUploadingAvatar(true);

    const formData = new FormData();
    formData.append("avatar", file); // Key must match backend ('avatar')

    try {
      const response = await axios.post("/api/users/update-avatar", formData, {
        headers: {
          "Content-Type": "multipart/form-data", // Important for file uploads
        },
      });

      if (response.data.success) {
        const newAvatarUrl = response.data.data.profilePictureUrl;
        console.log("New avatar URL:", newAvatarUrl);

        // Update profile state locally
        setProfile((prevProfile) =>
          prevProfile
            ? { ...prevProfile, profilePicture: newAvatarUrl }
            : null
        );

        // IMPORTANT: Update the session so the header avatar updates too
        await updateSession({
            ...session,
            user: {
                ...session?.user,
                image: newAvatarUrl, // Update the 'image' field in the session user
            },
        });

        console.log("Avatar updated successfully!");
        // Optionally clear the file input value
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }

      } else {
        setUploadError(response.data.message || "Failed to upload avatar.");
      }
    } catch (err: any) {
      console.error("Error uploading avatar:", err);
      setUploadError(
        err.response?.data?.message || "An error occurred during upload."
      );
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // --- Render Logic ---

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 pt-20">
        <p className="text-lg text-gray-600">Loading profile...</p>
      </div>
    );
  }

  if (error) {
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
    // Should be covered by error state, but as a fallback
    return (
      <div className="flex min-h-screen items-center justify-center p-4 pt-20">
        <p className="text-lg text-gray-600">Profile data unavailable.</p>
      </div>
    );
  }

  // --- Profile Display ---
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
    <div className="min-h-screen bg-gray-50 p-4 pt-20"> {/* Adjust pt for header */}
      <div className="mx-auto max-w-3xl">
        {/* Profile Header */}
        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col items-center sm:flex-row sm:items-start sm:space-x-6">
            {/* --- Avatar (Clickable on own profile) --- */}
            <div className="relative flex-shrink-0">
              <Image
                src={profilePic}
                alt={`${profile.username}'s avatar`}
                width={128} // Larger size for profile
                height={128}
                className={`h-32 w-32 rounded-full object-cover ring-4 ring-white ${
                  isOwnProfile ? "cursor-pointer hover:opacity-80" : ""
                } ${isUploadingAvatar ? "opacity-50" : ""}`} // Style changes for upload
                unoptimized
                onClick={handleAvatarClick} // Click handler added
                priority // Prioritize loading profile pic
              />
              {/* Loading/Spinner Overlay */}
              {isUploadingAvatar && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black bg-opacity-50">
                  {/* Replace with a proper spinner component if desired */}
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent border-white"></div>
                </div>
              )}
              {/* Hidden File Input */}
              {isOwnProfile && (
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/png, image/jpeg, image/gif, image/webp" // Accept common image types
                  className="hidden"
                  disabled={isUploadingAvatar}
                />
              )}
            </div>

            {/* Profile Info */}
            <div className="mt-4 flex flex-grow flex-col items-center text-center sm:mt-0 sm:items-start sm:text-left">
              <div className="flex w-full items-start justify-between sm:items-center"> {/* Adjusted alignment */}
                {/* Name and Username */}
                <div className="flex-grow"> {/* Allow text to take space */}
                    <h1 className="text-2xl font-bold text-gray-900">
                        {profile.name || profile.username}
                    </h1>
                    <p className="text-md text-gray-500">@{profile.username}</p>
                </div>
                {/* Follow/Edit Button */}
                {currentUserId && ( // Only show button if logged in
                    <div className="ml-4 mt-2 flex-shrink-0 sm:mt-0"> {/* Added margin-left */}
                    {isOwnProfile ? (
                        <button
                            onClick={handleAvatarClick} // Can also trigger from here
                            disabled={isUploadingAvatar}
                            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                        {isUploadingAvatar ? "Uploading..." : "Change Avatar"}
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

              {/* Upload Error Message */}
              {uploadError && isOwnProfile && (
                <p className="mt-2 w-full rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
                  {uploadError}
                </p>
              )}

              {/* Follow Stats */}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600"> {/* Added flex-wrap and gap */}
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
         <h2 className="mb-4 text-xl font-semibold text-gray-800">Posts</h2>
        <div className="space-y-4">
          {profile.posts && profile.posts.length > 0 ? (
            profile.posts.map((post) => (
              // Cast the post structure if needed, though ProfilePost should align
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
