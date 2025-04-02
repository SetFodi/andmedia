// components/CreatePostForm.tsx
"use client";

import React, { useState } from "react";
import axios from "axios";
import { useSession } from "next-auth/react";
import Image from "next/image";

interface CreatePostFormProps {
  onPostCreated: () => void; // Callback to notify parent (e.g., Feed) to refresh
}

const CreatePostForm: React.FC<CreatePostFormProps> = ({ onPostCreated }) => {
  const { data: session } = useSession();
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const characterLimit = 280;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!content.trim() || isLoading) return; // Prevent empty posts or double submits

    setIsLoading(true);
    setError(null);

    try {
      const response = await axios.post("/api/posts", { content });

      if (response.data.success) {
        setContent(""); // Clear the textarea
        onPostCreated(); // Trigger refresh in parent component
      } else {
        setError(response.data.message || "Failed to create post.");
      }
    } catch (err: any) {
      console.error("Error creating post:", err);
      setError(
        err.response?.data?.message || "An error occurred while posting."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const charsLeft = characterLimit - content.length;

  // Get user profile picture or default
  const profilePic = session?.user?.image ?? "/default-avatar.png";

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <form onSubmit={handleSubmit}>
        <div className="flex space-x-3">
          {/* User Avatar */}
          <Image
            src={profilePic}
            alt="Your avatar"
            width={40}
            height={40}
            className="h-10 w-10 rounded-full object-cover" // Fixed size
            unoptimized
          />
          {/* Textarea */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's happening?"
            className={`w-full resize-none rounded-md border p-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
              charsLeft < 0 ? "border-red-500" : "border-gray-300"
            }`}
            rows={3}
            maxLength={characterLimit + 20} // Allow slight overtyping for feedback
            disabled={isLoading}
            aria-label="Create a new post"
          />
        </div>

        {/* Error Message */}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        {/* Form Actions (Character count & Submit button) */}
        <div className="mt-3 flex items-center justify-end space-x-3">
          <span
            className={`text-sm ${
              charsLeft < 0
                ? "font-semibold text-red-600"
                : "text-gray-500"
            }`}
          >
            {charsLeft}
          </span>
          <button
            type="submit"
            disabled={isLoading || !content.trim() || charsLeft < 0}
            className={`rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {isLoading ? "Posting..." : "Post"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreatePostForm;
