// app/profile/[username]/page.tsx
"use client";

import React, { useState, useEffect, useCallback, useRef, FormEvent } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import Image from "next/image";
import PostItem from "@/components/PostItem";
import { IPost } from "@/models/Post";
import { PopulatedUser, PopulatedComment } from "@/components/PostItem";
import { useSession } from "next-auth/react";

// --- Edit Profile Modal Component ---
interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentName: string;
  currentBio: string;
  onProfileUpdate: (updatedData: { name?: string; bio?: string }) => void;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  currentName,
  currentBio,
  onProfileUpdate,
}) => {
  const [name, setName] = useState(currentName);
  const [bio, setBio] = useState(currentBio);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const characterLimit = 160;

  useEffect(() => {
    setName(currentName);
    setBio(currentBio);
    setError(null);
    setIsLoading(false);
  }, [isOpen, currentName, currentBio]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (bio.length > characterLimit) {
        setError(`Bio cannot exceed ${characterLimit} characters.`);
        setIsLoading(false);
        return;
    }

    try {
      const response = await axios.patch("/api/users/profile", {
        name: name,
        bio: bio,
      });

      if (response.data.success) {
        onProfileUpdate(response.data.data);
        onClose();
      } else {
        setError(response.data.message || "Failed to update profile.");
      }
    } catch (err: any) {
      console.error("Error updating profile:", err);
      setError(
        err.response?.data?.message || "An error occurred while updating."
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const charsLeft = characterLimit - bio.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-semibold">Edit Profile</h2>
        <form onSubmit={handleSubmit}>
          {error && (
            <p className="mb-3 rounded bg-red-100 p-2 text-center text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="mb-4">
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              disabled={isLoading}
            />
          </div>
          <div className="mb-4">
            <label htmlFor="bio" className="mb-1 block text-sm font-medium text-gray-700">
              Bio
            </label>
            <textarea
              id="bio"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className={`w-full resize-none rounded-md border px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm ${
                charsLeft < 0 ? "border-red-500" : "border-gray-300"
              }`}
              disabled={isLoading}
              maxLength={characterLimit + 10}
            />
             <p className={`mt-1 text-right text-xs ${charsLeft < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                {charsLeft} characters remaining
            </p>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || charsLeft < 0}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


// --- Profile Page Component ---
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
}

type ProfilePost = Omit<IPost, "author" | "likes" | "comments"> & {
  _id: string;
  author: PopulatedUser;
  likes: string[];
  comments: PopulatedComment[];
};


export default function ProfilePage() {
  const params = useParams();
  const username = params?.username as string;
  const { data: session, update: updateSession } = useSession();
  const currentUserId = session?.user?.id;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [localFollowersCount, setLocalFollowersCount] = useState(0);

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);


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
        const fetchedProfile = response.data.data as ProfileData;
        setProfile(fetchedProfile);
        setLocalFollowersCount(fetchedProfile.followersCount);
        setIsFollowing(false); // Placeholder
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
  }, [username]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleFollowToggle = async () => {
     if (!currentUserId || isFollowLoading || !profile) {
      if (!currentUserId) console.log("Please log in to follow users.");
      return;
    }
    setIsFollowLoading(true);
    const previousIsFollowing = isFollowing;
    const previousFollowersCount = localFollowersCount;
    setIsFollowing(!isFollowing);
    setLocalFollowersCount((prevCount) =>
      isFollowing ? prevCount - 1 : prevCount + 1
    );
    try {
      const response = await axios.post(`/api/users/${profile.username}/follow`);
      if (!response.data.success) {
        console.error("Failed to follow/unfollow:", response.data.message);
        setIsFollowing(previousIsFollowing);
        setLocalFollowersCount(previousFollowersCount);
      } else {
        console.log("Follow status updated successfully");
      }
    } catch (error) {
      console.error("Error calling follow API:", error);
      setIsFollowing(previousIsFollowing);
      setLocalFollowersCount(previousFollowersCount);
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleAvatarClick = () => {
     if (isOwnProfile) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
     const file = event.target.files?.[0];
    if (!file || !profile) return;
    setUploadError(null);
    setIsUploadingAvatar(true);
    const formData = new FormData();
    formData.append("avatar", file);
    try {
      const response = await axios.post("/api/users/update-avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (response.data.success) {
        const newAvatarUrl = response.data.data.profilePictureUrl;
        setProfile((prevProfile) =>
          prevProfile ? { ...prevProfile, profilePicture: newAvatarUrl } : null
        );
        await updateSession({
            ...session,
            user: { ...session?.user, image: newAvatarUrl },
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        setUploadError(response.data.message || "Failed to upload avatar.");
      }
    } catch (err: any) {
      console.error("Error uploading avatar:", err);
      setUploadError(err.response?.data?.message || "An error occurred during upload.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleProfileUpdate = (updatedData: { name?: string; bio?: string }) => {
    setProfile((prevProfile) =>
      prevProfile ? { ...prevProfile, ...updatedData } : null
    );
    if (updatedData.name !== undefined && session?.user?.name !== updatedData.name) {
        updateSession({
            ...session,
            user: { ...session?.user, name: updatedData.name },
        });
    }
    console.log("Profile updated locally.");
  };


  // --- Render Logic ---
  // CORRECTED: Added return statements
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
  const isOwnProfile = currentUserId === profile._id;

  return (
    <> {/* Use Fragment to allow modal sibling */}
      <div className="min-h-screen bg-gray-50 p-4 pt-20">
        <div className="mx-auto max-w-3xl">
          {/* Profile Header */}
          <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col items-center sm:flex-row sm:items-start sm:space-x-6">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                 <Image
                    src={profilePic}
                    alt={`${profile.username}'s avatar`}
                    width={128}
                    height={128}
                    className={`h-32 w-32 rounded-full object-cover ring-4 ring-white ${
                    isOwnProfile ? "cursor-pointer hover:opacity-80" : ""
                    } ${isUploadingAvatar ? "opacity-50" : ""}`}
                    unoptimized
                    onClick={handleAvatarClick}
                    priority
                />
                {isUploadingAvatar && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black bg-opacity-50">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent border-white"></div>
                    </div>
                )}
                {isOwnProfile && (
                    <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/png, image/jpeg, image/gif, image/webp"
                    className="hidden"
                    disabled={isUploadingAvatar}
                    />
                )}
              </div>

              {/* Profile Info */}
              <div className="mt-4 flex flex-grow flex-col items-center text-center sm:mt-0 sm:items-start sm:text-left">
                <div className="flex w-full items-start justify-between sm:items-center">
                  <div className="flex-grow">
                    <h1 className="text-2xl font-bold text-gray-900">
                      {profile.name || profile.username}
                    </h1>
                    <p className="text-md text-gray-500">@{profile.username}</p>
                  </div>
                  {currentUserId && (
                    <div className="ml-4 mt-2 flex-shrink-0 sm:mt-0">
                      {isOwnProfile ? (
                        <button
                          onClick={() => setIsEditModalOpen(true)}
                          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                        >
                          Edit Profile
                        </button>
                      ) : (
                         <button
                            onClick={handleFollowToggle}
                            disabled={isFollowLoading}
                            className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 ${
                                isFollowing
                                ? "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-400"
                                : "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500"
                            }`}
                            >
                            {isFollowLoading ? "..." : isFollowing ? "Unfollow" : "Follow"}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {uploadError && isOwnProfile && (
                    <p className="mt-2 w-full rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700">
                    {uploadError}
                    </p>
                )}

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
                     <span><span className="font-semibold text-gray-900">{profile.posts?.length ?? 0}</span> Posts</span>
                    <span><span className="font-semibold text-gray-900">{localFollowersCount}</span> Followers</span>
                    <span><span className="font-semibold text-gray-900">{profile.followingCount}</span> Following</span>
                </div>

                {profile.bio && (
                  <p className="mt-3 text-sm text-gray-700">{profile.bio}</p>
                )}

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

      {/* --- Edit Profile Modal --- */}
      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        currentName={profile?.name || ''} // Use optional chaining and provide default
        currentBio={profile?.bio || ''}   // Use optional chaining and provide default
        onProfileUpdate={handleProfileUpdate}
      />
    </>
  );
}

