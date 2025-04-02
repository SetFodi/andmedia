// app/api/auth/[...nextauth]/route.ts
import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import mongoose from "mongoose"; // Import mongoose for Types.ObjectId
import dbConnect from "@/lib/dbConnect";
import User, { IUser } from "@/models/User";

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: {
          label: "Email or Username",
          type: "text",
          placeholder: "jsmith@example.com",
        },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req): Promise<IUser | null> {
        if (!credentials?.identifier || !credentials.password) {
          return null; // Or throw an error
        }

        await dbConnect();

        try {
          // Find user by email or username
          const user = await User.findOne({
            $or: [
              { email: credentials.identifier.toLowerCase() },
              { username: credentials.identifier.toLowerCase() },
            ],
          }).select("+password"); // Explicitly select password for comparison

          if (!user) {
            console.log("No user found with identifier:", credentials.identifier);
            return null; // User not found
          }

          if (!user.password) {
            console.log("User found but has no password set (OAuth?):", user.email);
            return null;
          }

          const isPasswordCorrect = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (isPasswordCorrect) {
            console.log("Password correct for:", user.email);
            // Return the user object without the password
            // Ensure _id is included when converting
            const userObject = user.toObject({ getters: true }); // Use getters: true if needed for virtuals, but _id is standard
            const { password, ...userWithoutPassword } = userObject;
            return userWithoutPassword as IUser; // This object will have _id
          } else {
            console.log("Incorrect password for:", user.email);
            return null; // Incorrect password
          }
        } catch (err: any) {
          console.error("Error during authorization:", err);
          return null;
        }
      },
    }),
    // Add other providers like Google, GitHub etc. here later
  ],
  callbacks: {
    async jwt({ token, user }) {
      // If user object exists (on sign in), add user details to the token
      // The 'user' object here comes from the 'authorize' callback result
      if (user) {
        // Explicitly use _id from the Mongoose object and convert to string
        // The user object from authorize should have _id after .toObject()
        const mongoUser = user as IUser & { _id: mongoose.Types.ObjectId | string }; // Add _id type hint

        if (mongoUser._id) {
          // Ensure it's a string before assigning
          token.id =
            typeof mongoUser._id === "string"
              ? mongoUser._id
              : mongoUser._id.toString();
        } else {
          // Fallback or error handling if _id is somehow missing
          console.error("JWT Callback: User object missing _id", user);
          // Potentially return null or throw error if ID is critical
        }

        // Cast user to IUser to access our custom properties
        const customUser = user as IUser;
        token.username = customUser.username;
        token.email = customUser.email;
        token.name = customUser.name;
        token.picture = customUser.profilePicture; // Use profilePicture from our model
      }
      return token;
    },
    async session({ session, token }) {
      // Add properties from the token to the session object
      // Add safety check for token and token.id
      if (token && token.id) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string | null | undefined;
        session.user.image = token.picture as string | null | undefined; // Map our picture to session.user.image
      } else {
        // Log error if token or token.id is missing when creating session
        console.error(
          "Session Callback: Token is missing or missing 'id' property.",
          token
        );
        // You might want to clear parts of session.user or handle this case
        // For now, we just don't add the properties if token.id is missing
      }
      return session;
    },
  },
  session: {
    strategy: "jwt", // Use JSON Web Tokens for session management
  },
  secret: process.env.NEXTAUTH_SECRET, // Your session secret
  pages: {
    signIn: "/login", // Redirect users to /login if they need to sign in
  },
  debug: process.env.NODE_ENV === "development", // Enable debug messages in development
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
