// components/CreatePostForm.tsx
"use client";

import React, { useState, useRef } from "react"; // Added useRef
import axios from "axios";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { useSocket } from "@/context/SocketContext";
import { PopulatedPost } from "./Feed"; // Assuming Feed exports this type

interface CreatePostFormProps {
  onPostCreated: () => void;
}

const CreatePostForm: React.FC<CreatePostFormProps> = ({ onPostCreated }) => {
  const { data: session } = useSession();
  const { socket, isConnected } = useSocket();
  const [content, setContent] = useState("");
  const [isLoading, setIsLoading] = useState(false); // Combined loading state
  const [error, setError] = useState<string | null>(null);
  const characterLimit = 280;

  // State for image upload
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null); // Ref for hidden file input

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Basic client-side validation (optional, backend validates too)
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB example
        setError("Image size cannot exceed 10MB.");
        return;
      }

      setImageFile(file);
      // Create object URL for preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setError(null); // Clear previous errors
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = ""; // Clear the file input
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Require content OR an image file
    if ((!content.trim() && !imageFile) || isLoading) return;

    setIsLoading(true);
    setError(null);
    let imageUrl: string | undefined = undefined;

    try {
      // 1. Upload image if selected
      if (imageFile) {
        console.log("Uploading image...");
        const formData = new FormData();
        formData.append("file", imageFile); // Use 'file' field name

        try {
          const uploadResponse = await axios.post("/api/files/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          if (uploadResponse.data.success) {
            imageUrl = uploadResponse.data.data.fileUrl;
            console.log("Image uploaded, URL:", imageUrl);
          } else {
            throw new Error(uploadResponse.data.message || "Image upload failed.");
          }
        } catch (uploadError: any) {
          console.error("Image upload error:", uploadError);
          setError(uploadError.response?.data?.message || uploadError.message || "Failed to upload image.");
          setIsLoading(false);
          return; // Stop post creation if image upload fails
        }
      }

      // 2. Create the post (with or without image URL)
      console.log("Creating post with content:", content, "and imageUrl:", imageUrl);
      const postPayload = {
        content: content.trim(),
        ...(imageUrl && { imageUrl: imageUrl }), // Conditionally add imageUrl
      };
      const response = await axios.post("/api/posts", postPayload);

      if (response.data.success) {
        const newPostData = response.data.data as PopulatedPost;

        // Reset form state
        setContent("");
        removeImage(); // Clear image preview and file state
        onPostCreated(); // Trigger refresh for the user who posted

        // Emit event for other clients via server
        if (socket && isConnected) {
          console.log("CreatePostForm: Emitting 'new_post_from_client'", newPostData);
          socket.emit("new_post_from_client", newPostData);
        } else { /* ... warning ... */ }

      } else {
        setError(response.data.message || "Failed to create post.");
      }
    } catch (err: any) {
      // Catch errors from the post creation call
      console.error("Error creating post:", err);
      setError(err.response?.data?.message || "An error occurred while posting.");
    } finally {
      setIsLoading(false);
    }
  };

  const charsLeft = characterLimit - content.length;
  const profilePic = session?.user?.image ?? "/default-avatar.png";

  return (
    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <form onSubmit={handleSubmit}>
        <div className="flex space-x-3">
          <Image src={profilePic} alt="Your avatar" width={40} height={40} className="h-10 w-10 flex-shrink-0 rounded-full object-cover" unoptimized />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's happening?"
            className={`w-full resize-none rounded-md border p-2 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${ charsLeft < 0 ? "border-red-500" : "border-gray-300" }`}
            rows={3}
            maxLength={characterLimit + 20}
            disabled={isLoading}
            aria-label="Create a new post"
          />
        </div>

        {/* Image Preview */}
        {imagePreview && (
          <div className="relative mt-3">
            <Image
              src={imagePreview}
              alt="Image preview"
              width={500} // Adjust preview size as needed
              height={300}
              className="h-auto max-h-[40vh] w-full rounded-lg border border-gray-300 object-contain" // Use object-contain
            />
            {/* Remove Image Button */}
            <button
              type="button"
              onClick={removeImage}
              disabled={isLoading}
              className="absolute right-2 top-2 rounded-full bg-black bg-opacity-50 p-1 text-white hover:bg-opacity-75 disabled:cursor-not-allowed"
              aria-label="Remove image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        {/* Form Actions */}
        <div className="mt-3 flex items-center justify-between">
          {/* Image Upload Button */}
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={isLoading}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Add image"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-6 w-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
          </button>
          {/* Hidden File Input */}
          <input
            type="file"
            ref={imageInputRef}
            onChange={handleImageChange}
            accept="image/png, image/jpeg, image/gif, image/webp"
            className="hidden"
            disabled={isLoading}
          />

          {/* Character count & Submit button */}
          <div className="flex items-center space-x-3">
            <span className={`text-sm ${ charsLeft < 0 ? "font-semibold text-red-600" : "text-gray-500" }`}>
              {charsLeft}
            </span>
            <button
              type="submit"
              disabled={isLoading || (!content.trim() && !imageFile) || charsLeft < 0} // Disable if no content AND no image
              className={`rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {isLoading ? "Posting..." : "Post"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CreatePostForm;
