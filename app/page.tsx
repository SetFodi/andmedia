// app/page.tsx
"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useState, useCallback } from "react"; // Import useState and useCallback
import CreatePostForm from "@/components/CreatePostForm";
import Feed from "@/components/Feed"; // Import the Feed component

export default function HomePage() {
  const { data: session, status } = useSession();
  // State to trigger feed refresh. Incrementing it forces Feed to re-run useEffect.
  const [feedKey, setFeedKey] = useState(0);

  // Callback to trigger feed refresh by updating the key
  const refreshFeed = useCallback(() => {
    setFeedKey((prevKey) => prevKey + 1);
  }, []);

  // Handle loading state
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-gray-600">Loading session...</p>
      </div>
    );
  }

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-50 p-4 pt-8">
      {/* Header/Nav Placeholder */}
      <header className="fixed left-0 right-0 top-0 z-10 mb-6 w-full border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between p-3">
          <h1 className="text-xl font-bold text-indigo-600">
            Fancy Social
          </h1>
          {status === "authenticated" && session?.user && (
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Hi, {session.user.username || session.user.name}!
              </span>
              <button
                onClick={handleLogout}
                className="rounded bg-red-500 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-red-600"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mt-16 w-full max-w-2xl">
        {" "}
        {/* Add margin-top to account for fixed header */}
        {status === "authenticated" && session?.user ? (
          // --- User is Logged In ---
          <div>
            {/* Pass the refreshFeed callback to the form */}
            <CreatePostForm onPostCreated={refreshFeed} />

            {/* Pass the feedKey to Feed component to trigger re-fetch on change */}
            {/* Also pass refreshFeed if Feed needs to trigger its own refresh */}
            <Feed key={feedKey} />
          </div>
        ) : (
          // --- User is Not Logged In ---
          <div className="mt-20 rounded-lg bg-white p-8 text-center shadow-md">
            <h1 className="mb-4 text-3xl font-bold text-indigo-600">
              Welcome to Fancy Social Media!
            </h1>
            <p className="mb-6 text-lg text-gray-700">
              Please log in or register to see the feed and post.
            </p>
            <div className="flex justify-center space-x-4">
              <Link
                href="/login"
                className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-green-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                Register
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
