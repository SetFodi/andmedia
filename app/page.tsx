// app/page.tsx
"use client"; // Need client component for useSession and onClick

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export default function HomePage() {
  // useSession hook to get session data and status
  const { data: session, status } = useSession();

  // Handle loading state
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-gray-600">Loading session...</p>
        {/* You could add a spinner here */}
      </div>
    );
  }

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" }); // Redirect to login after logout
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white p-8 text-center shadow-md">
        <h1 className="mb-4 text-3xl font-bold text-indigo-600">
          Welcome to Fancy Social Media!
        </h1>

        {status === "authenticated" && session?.user ? (
          // --- User is Logged In ---
          <div>
            <p className="mb-2 text-xl text-gray-800">
              Hello,{" "}
              <span className="font-semibold">
                {session.user.username || session.user.name || session.user.email}
              </span>
              !
            </p>
            <p className="mb-4 text-sm text-gray-500">
              (ID: {session.user.id})
            </p>
            {/* Add more user details or profile picture if available */}
            {/* {session.user.image && (
              <img
                src={session.user.image}
                alt="Profile"
                className="mx-auto mb-4 h-16 w-16 rounded-full"
              />
            )} */}

            {/* Placeholder for Feed/Content */}
            <div className="my-6 rounded border border-dashed border-gray-300 p-6">
              <p className="text-gray-500">Your feed will appear here...</p>
            </div>

            <button
              onClick={handleLogout}
              className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              Logout
            </button>
          </div>
        ) : (
          // --- User is Not Logged In ---
          <div>
            <p className="mb-6 text-lg text-gray-700">
              Please log in or register to continue.
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
      </div>
    </div>
  );
}
