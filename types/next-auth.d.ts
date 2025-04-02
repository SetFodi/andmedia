// types/next-auth.d.ts
import "next-auth";
import { DefaultSession, DefaultUser } from "next-auth";

// Extend the built-in session/user types to include properties from our JWT/callbacks
declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      id?: string | null; // Add our custom id property
      username?: string | null; // Add our custom username property
    } & DefaultSession["user"]; // Keep the default properties like name, email, image
  }

  /**
   * The shape of the user object returned in the OAuth providers' `profile` callback,
   * or the second parameter of the `session` callback, when using a database.
   * Also used in the `authorize` callback function for Credentials provider.
   */
  interface User extends DefaultUser {
    // Add properties returned by your authorize function or profile callback
    username?: string | null;
    profilePicture?: string | null;
    // Add any other properties you expect on the User object used within next-auth callbacks
  }
}

// Extend the JWT type if you need to access custom properties in the jwt callback's token parameter
declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    id?: string;
    username?: string;
    picture?: string | null; // Match the property name used in the jwt callback
    // Add any other properties you added to the token in the jwt callback
  }
}
