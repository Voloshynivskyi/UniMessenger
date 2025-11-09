// frontend/src/realtime/socketClient.ts
import { io, Socket } from "socket.io-client";
import type { ServerToClientEvents, ClientToServerEvents } from "./events"; // зараз поясню

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:7007";

export const socket: Socket<
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents
> = io(API_URL, {
  auth: (cb) => {
    const token = localStorage.getItem("authToken");
    cb({ token: token ?? "" });
  },
  autoConnect: false,
});

socket.on("connect", () => {
  console.log("✅ Realtime connected:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("❎ Realtime disconnected:", reason);
});

socket.on("connect_error", (err) => {
  console.error("🚨 Realtime error:", err.message);
});
socket.on("telegram:new_message", (data) => {
  console.log("New message:", data);
});

socket.on("telegram:typing", (data) => {
  console.log("Someone is typing:", data);
});

socket.on("telegram:account_status", (data) => {
  console.log("Status changed:", data);
});

socket.on("telegram:message_deleted", (data) => {
  console.log("Message deleted:", data);
});

socket.on("telegram:message_edited", (data) => {
  console.log("Message edited:", data);
});

socket.on("telegram:read_updates", (data) => {
  console.log("Read updates:", data);
});
