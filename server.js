// server.js
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const { setIoInstance } = require("./lib/socketInstance"); // Keep using this

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function initializeSocketIO(httpServer) {
  console.log("Initializing Socket.IO server...");
  const io = new Server(httpServer, {
    // Add CORS options if needed for production
    // cors: { origin: "YOUR_FRONTEND_URL", methods: ["GET", "POST"] },
  });

  io.on("connection", (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    socket.on("hello", (msg) => {
      console.log(`Message from ${socket.id}: ${msg}`);
      socket.emit("helloFromServer", `Server received your message: ${msg}`);
    });

    // Listener for like updates from client
    socket.on("like_updated_from_client", (data) => {
      if (data && data.postId && Array.isArray(data.likes)) {
          console.log(`Server received 'like_updated_from_client' for post ${data.postId} from ${socket.id}`);
          // Broadcast 'like_updated' to all *other* connected clients
          socket.broadcast.emit("like_updated", data);
      } else {
          console.warn(`Server received invalid 'like_updated_from_client' data from ${socket.id}:`, data);
      }
    });

    // Listener for new posts from client
    socket.on("new_post_from_client", (postData) => {
        if (postData && postData._id && postData.author) {
            console.log(`Server received 'new_post_from_client' (ID: ${postData._id}) from ${socket.id}`);
            // Broadcast 'post_created' to all *other* connected clients
            socket.broadcast.emit("post_created", postData);
        } else {
            console.warn(`Server received invalid 'new_post_from_client' data from ${socket.id}:`, postData);
        }
    });

    // --- ADDED LISTENER FOR NEW COMMENTS FROM CLIENT ---
    socket.on("new_comment_from_client", (commentData) => {
        // commentData should be { postId: string, comment: PopulatedComment }
        if (commentData && commentData.postId && commentData.comment?._id) {
            console.log(`Server received 'new_comment_from_client' for post ${commentData.postId} from ${socket.id}`);
            // Broadcast 'comment_added' to all *other* connected clients
            // Send the same structure back
            socket.broadcast.emit("comment_added", commentData);
        } else {
            console.warn(`Server received invalid 'new_comment_from_client' data from ${socket.id}:`, commentData);
        }
    });
    // --- END ADDED LISTENER ---

    socket.on("disconnect", (reason) => {
      console.log(`🔌 Socket disconnected: ${socket.id}, Reason: ${reason}`);
    });

    socket.on("connect_error", (err) => {
        console.error(`Socket connect_error: ${err.message}`);
    });
  });

  setIoInstance(io); // Store instance using the module setter
  console.log("Socket.IO server initialized successfully.");
  return io;
}


app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  initializeSocketIO(httpServer);

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
     })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
