// app/api/auth/[...nextauth]/route.ts
import NextAuth, { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
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

          // Check if password was included (it might not be for OAuth users later)
          if (!user.password) {
            console.log("User found but has no password set (OAuth?):", user.email);
            return null; // Cannot log in with credentials if no password is set
          }

          // Compare passwords
          const isPasswordCorrect = await bcrypt.compare(
            credentials.password,
            user.password
          );

          if (isPasswordCorrect) {
            console.log("Password correct for:", user.email);
            // Return the user object without the password
            const { password, ...userWithoutPassword } = user.toObject();
            return userWithoutPassword as IUser;
          } else {
            console.log("Incorrect password for:", user.email);
            return null; // Incorrect password
          }
        } catch (err: any) {
          console.error("Error during authorization:", err);
          // throw new Error(err); // Or return null
          return null;
        }
      },
    }),
    // Add other providers like Google, GitHub etc. here later
  ],
  callbacks: {
    async jwt({ token, user }) {
      // If user object exists (on sign in), add user details to the token
      if (user) {
        token.id = user.id; // user.id is provided by next-auth based on the authorize result
        token.username = (user as IUser).username; // Cast user to IUser to access username
        token.email = user.email;
        token.name = user.name;
        token.picture = user.profilePicture; // Use profilePicture from our model
      }
      return token;
    },
    async session({ session, token }) {
      // Add properties from the token to the session object
      if (token) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        // Keep default session.user.email, name, image if needed, or override
        session.user.email = token.email as string;
        session.user.name = token.name as string | null | undefined;
        session.user.image = token.picture as string | null | undefined; // Map our picture to session.user.image
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
    // error: '/auth/error', // Optional: Error code passed in query string as ?error=
    // newUser: '/auth/new-user' // Optional: New users will be directed here first
  },
  debug: process.env.NODE_ENV === "development", // Enable debug messages in development
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
