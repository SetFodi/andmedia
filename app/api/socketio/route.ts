// app/api/socketio/route.ts
import { Server as NetServer, Socket } from "net";
import { NextApiRequest, NextApiResponse } from "next"; // Import NextApi types
import { Server as SocketIOServer } from "socket.io";
import { NextRequest, NextResponse } from "next/server"; // Use NextResponse for App Router

// Type definition for the response expected by Socket.IO setup
// Augmenting the NextApiResponse type
type NextApiResponseWithSocket = NextResponse & { // Use NextResponse base
  socket: Socket & {
    server: NetServer & {
      io?: SocketIOServer; // Optional io instance
    };
  };
};

// We export GET, but it primarily sets up the socket on the first run
// Subsequent requests to this route might not be necessary for clients
// if the socket server is already running.
export async function GET(req: NextRequest, res: NextApiResponseWithSocket) {
  // It's essential to check if the server and io instance already exist.
  // This check might be tricky in App Router context compared to Pages Router's res.socket.server
  // Let's try attaching to global scope as a workaround for App Router's nature

  // @ts-ignore - Accessing global scope for singleton pattern
  if (global.ioInstance) {
    console.log("Socket is already running");
    // In App Router, returning NextResponse might be standard,
    // but Socket.IO client expects specific handshake.
    // For setup, just indicating success might be okay, or maybe end the response?
    // Let's return a simple success message. The client connection happens separately.
    return NextResponse.json({ success: true, message: "Socket already running"}, { status: 200 });
  }

  console.log("Socket is initializing");
  // Need access to the underlying HTTP server instance. This is difficult in App Router.
  // The standard Pages Router pattern `res.socket.server` doesn't directly apply.

  // --- WORKAROUND: Assume server is available via a non-standard path ---
  // This is highly dependent on the deployment environment (Vercel, Node)
  // and might break. A more robust solution might need different architecture.
  // @ts-ignore
  const httpServer = res.socket?.server as any;
  if (!httpServer) {
      console.error("HTTP server instance not found. Cannot initialize Socket.IO.");
      return NextResponse.json({ success: false, message: "Failed to initialize socket: Server not found."}, { status: 500 });
  }

  const io = new SocketIOServer(httpServer, {
    path: "/api/socketio", // IMPORTANT: Define path for client connection
    addTrailingSlash: false, // Prevent potential issues with path matching
    cors: { origin: "*", methods: ["GET", "POST"] }, // Adjust CORS as needed
  });

  // Store the instance globally for access from other API routes
  // @ts-ignore - Attaching to global scope
  global.ioInstance = io;

  // Define socket connection logic (similar to server.js)
  io.on("connection", (socket) => {
    console.log(`🔌 API Route: Socket connected: ${socket.id}`);

    socket.on("hello", (msg) => {
      console.log(`API Route: Message from ${socket.id}: ${msg}`);
      socket.emit("helloFromServer", `API Route Server received: ${msg}`);
    });

    socket.on("disconnect", (reason) => {
      console.log(`🔌 API Route: Socket disconnected: ${socket.id}, Reason: ${reason}`);
    });

     socket.on("connect_error", (err) => {
        console.error(`API Route: Socket connect_error: ${err.message}`);
    });
  });

  console.log("Socket server initialized on API route");
  // End the response for the GET request itself
  // Returning a JSON response might be more standard for App Router GET
   return NextResponse.json({ success: true, message: "Socket initialized"}, { status: 201 }); // 201 Created (or 200 OK)
}

// We don't need POST, PUT, DELETE etc. for this specific route's purpose
