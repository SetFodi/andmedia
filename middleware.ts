// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Define routes that are public (accessible without login)
const publicRoutes = ["/login", "/register", "/api/auth/register"]; // Add other public API routes if needed

// Define routes related to authentication (login, register)
const authRoutes = ["/login", "/register"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the route is for static files, Next.js internals, or favicon
  // Allow these requests to pass through without checks
  if (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/static/") ||
    pathname.startsWith("/api/auth/") || // Allow all next-auth API routes
    pathname.includes(".") || // Assume file extensions are static assets
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Get the token from the request
  // Use the raw request object for getToken
  // Ensure NEXTAUTH_SECRET is set in your environment variables
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  const isLoggedIn = !!token;

  console.log(`Middleware: Pathname: ${pathname}, IsLoggedIn: ${isLoggedIn}`); // Debug log

  // --- Route Protection Logic ---

  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  // If user is logged in
  if (isLoggedIn) {
    // If they try to access login/register pages, redirect to home
    if (isAuthRoute) {
      console.log("Middleware: Logged in user accessing auth route, redirecting to /");
      return NextResponse.redirect(new URL("/", request.url));
    }
    // Otherwise, allow access to the requested page (including protected routes)
    return NextResponse.next();
  }

  // If user is NOT logged in
  else {
    // If they try to access a protected route (not public and not auth related)
    if (!isPublicRoute && !isAuthRoute) {
      console.log(
        "Middleware: Not logged in user accessing protected route, redirecting to /login"
      );
      // Redirect to login page, preserving the intended destination via callbackUrl
      const callbackUrl = encodeURIComponent(pathname + request.nextUrl.search);
      return NextResponse.redirect(
        new URL(`/login?callbackUrl=${callbackUrl}`, request.url)
      );
    }
    // Otherwise, allow access (to public routes like /login, /register)
    return NextResponse.next();
  }
}

// --- Matcher Configuration ---
// Configure the middleware to run on specific paths.
// Avoid running it on API routes or static files by default.
// Adjust the matcher pattern as needed for your application structure.
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes) - Handled explicitly above
     * - _next/static (static files) - Handled explicitly above
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static (custom static folder if you have one) - Handled explicitly above
     * - files with extensions (e.g. .png) - Handled explicitly above
     */
    // This regex aims to match pages and exclude common static/API paths.
    // It might need refinement based on your specific routes.
    "/((?!api|_next/static|_next/image|favicon.ico|static|.*\\.).*)",
  ],
};
