// context/SocketContext.tsx
"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react"; // Import useRef
import { io, Socket } from "socket.io-client";

interface ISocketContext {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<ISocketContext>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => {
  return useContext(SocketContext);
};

interface SocketProviderProps {
  children: React.ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  // Use useRef to hold the socket instance - its reference won't change across renders
  const socketRef = useRef<Socket | null>(null);
  // Still use useState for isConnected, as changes to it SHOULD trigger re-renders
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Prevent running on server
    if (typeof window === "undefined") return;

    // Initialize ONLY if the ref is currently null (i.e., first mount)
    if (!socketRef.current) {
      const socketIoUrl = process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin;
      console.log(`SocketContext: Initializing NEW socket connection to ${socketIoUrl}`);

      // Store the new socket instance in the ref's .current property
      socketRef.current = io(socketIoUrl, {
        reconnectionAttempts: 5,
        reconnectionDelay: 5000,
        autoConnect: true,
        transports: ["websocket"],
      });

      // --- Event Listeners (attach to socketRef.current) ---
      socketRef.current.on("connect", () => {
        console.log("✅ Socket connected (Client):", socketRef.current?.id);
        setIsConnected(true); // Update state to trigger re-render
        socketRef.current?.emit("hello", "Client connected!");
      });

      socketRef.current.on("disconnect", (reason) => {
        console.log("🔌 Socket disconnected (Client):", reason);
        setIsConnected(false); // Update state
      });

      socketRef.current.on("connect_error", (error) => {
        console.error("❌ Socket connection error (Client):", error);
        setIsConnected(false); // Update state
      });

      socketRef.current.on("helloFromServer", (msg) => {
        console.log("Message from server (Client):", msg);
      });

    } // End of initialization block

    // --- Cleanup function for when the SocketProvider unmounts ---
    return () => {
      // Check if socket exists and is connected before disconnecting
      if (socketRef.current?.connected) {
        console.log("🧹 SocketProvider Unmount: Disconnecting socket...");
        socketRef.current.disconnect();
      }
      // Important: Set the ref back to null when the provider unmounts
      // This allows re-initialization if the provider is ever remounted
      socketRef.current = null;
      setIsConnected(false); // Reset connection state
      console.log("🧹 SocketProvider Unmount: Cleanup complete.");
    };
  }, []); // Empty dependency array: runs effect once on mount, cleanup on unmount

  // Provide the current socket instance from the ref and the connection status
  // The socketRef.current reference is stable across provider re-renders
  return (
    <SocketContext.Provider value={{ socket: socketRef.current, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
