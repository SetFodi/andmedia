// server.js
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io"); // Import Socket.IO Server

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost"; // Or your desired hostname
const port = 3000; // Or your desired port

// When using middleware, disable the route handler parsing
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Create the HTTP server using Node's http module
  const httpServer = createServer(async (req, res) => {
    try {
      // Be sure to pass `true` as the second argument to `url.parse`.
      // This tells it to parse the query portion of the URL.
      const parsedUrl = parse(req.url, true);
      // const { pathname, query } = parsedUrl; // Example: Extract path and query if needed

      // Let Next.js handle the request
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  // --- Initialize Socket.IO ---
  const io = new Server(httpServer, {
    // Optional: Configure CORS if your client is on a different origin in production
    // cors: {
    //   origin: "YOUR_FRONTEND_URL", // e.g., "https://yourapp.com"
    //   methods: ["GET", "POST"]
    // }
    // Optional: Configure path if needed
    // path: "/api/socketio" // Example path
  });

  // --- Socket.IO Connection Logic ---
  io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // Example: Join a room based on user ID (requires authentication info)
    // socket.on('joinUserRoom', (userId) => {
    //   console.log(`Socket ${socket.id} joining room for user ${userId}`);
    //   socket.join(`user_${userId}`);
    // });

    // Example: Listen for a 'hello' event from client
    socket.on("hello", (msg) => {
      console.log(`Message from ${socket.id}: ${msg}`);
      // Broadcast back to the specific client
      socket.emit("helloFromServer", `Server received your message: ${msg}`);
    });

    // --- TODO: Add listeners for specific app events ---
    // e.g., socket.on('newPostCreated', (postData) => { ... });
    // e.g., socket.on('postLiked', (likeData) => { ... });

    socket.on("disconnect", (reason) => {
      console.log(`🔌 Socket disconnected: ${socket.id}, Reason: ${reason}`);
    });

    socket.on("connect_error", (err) => {
        console.error(`Socket connect_error: ${err.message}`);
    });
  });
  // --- End Socket.IO Logic ---

  // Start listening
  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Socket.IO server initialized`);
    });
});
