// lib/socketInstance.js

// This module acts as a singleton holder for the Socket.IO instance
let io = null;

export function setIoInstance(ioInstance) {
  console.log("Socket instance being set in module.");
  io = ioInstance;
}

export function getIoInstance() {
  // console.log("getIoInstance called, returning:", io ? 'Instance' : 'null');
  return io;
}
