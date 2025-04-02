// app/login/page.tsx
"use client";

import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation"; // Use next/navigation for App Router
import Link from "next/link";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState(""); // Can be email or username
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null); // Clear previous errors
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        redirect: false, // Prevent NextAuth from redirecting automatically
        identifier: identifier,
        password: password,
      });

      setIsLoading(false);

      if (result?.error) {
        // Handle different errors or display a generic message
        console.error("Sign-in error:", result.error);
        if (result.error === "CredentialsSignin") {
          setError("Invalid email/username or password.");
        } else {
          setError("An unexpected error occurred. Please try again.");
        }
      } else if (result?.ok) {
        // Sign-in successful
        console.log("Sign-in successful, redirecting...");
        // Redirect to the home page or dashboard
        router.push("/"); // Redirect to home page
        router.refresh(); // Optional: Refresh server components after login
      } else {
        // Handle other potential non-error, non-ok states if necessary
        setError("Login failed. Please try again.");
      }
    } catch (err) {
      setIsLoading(false);
      console.error("Login submission error:", err);
      setError("An unexpected error occurred during login.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <h2 className="mb-6 text-center text-2xl font-bold text-gray-800">
          Login
        </h2>
        <form onSubmit={handleSubmit}>
          {error && (
            <p className="mb-4 rounded bg-red-100 p-3 text-center text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="mb-4">
            <label
              htmlFor="identifier"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Email or Username
            </label>
            <input
              type="text"
              id="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              placeholder="you@example.com or your_username"
              disabled={isLoading}
            />
          </div>
          <div className="mb-6">
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
              placeholder="********"
              disabled={isLoading}
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                isLoading
                  ? "cursor-not-allowed bg-indigo-400"
                  : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {isLoading ? "Logging in..." : "Login"}
            </button>
          </div>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">
          Don't have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-indigo-600 hover:text-indigo-500"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
