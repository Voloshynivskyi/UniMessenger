/**
 * backend/realtime/socketServer.ts
 * Initializes Socket.IO and exports a function to attach it to the app later.
 */
import { Server, Socket } from "socket.io";
import http from "http";
import { socketAuth } from "./middleware/socketAuth";
import { initSocketGateway } from "./socketGateway";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
} from "./events";
import telegramClientManager from "../services/telegram/telegramClientManager";
import { Api } from "telegram";
import bigInt from "big-integer";
import { telegramSocketHandlers } from "./telegramSocketHandlers";
let io: Server | null = null;
let server: http.Server | null = null;

export function createSocketServer(app: any) {
  server = http.createServer(app);
  io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents
  >(server, {
    cors: { origin: "*" },
  });
  initSocketGateway(io);
  // Apply authentication middleware

  io.use(socketAuth);

  // Handle client connections

  io.on(
    "connection",
    (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
      const userId = socket.data.userId;
      console.log("✅ New client connected:", socket.id, "user:", userId);

      // Join a room for the user

      socket.join(userId);

      // Handle user-specific events

      // 🔹 Client → Server: "system:ping"
      socket.on("system:ping", () => {
        // 🔹 Server → Client: "system:pong"
        socket.emit("system:pong");
      });

      /**
       * Telegram event handlers (Client → Server)
       * Each handler calls the corresponding function in telegramSocketHandlers
       */
      // Send Message
      socket.on("telegram:send_message", (data) =>
        telegramSocketHandlers.sendMessage(socket, data)
      );
      // Edit Message
      socket.on("telegram:edit_message", (data) =>
        telegramSocketHandlers.editMessage(socket, data)
      );
      // Delete Message
      socket.on("telegram:delete_message", (data) =>
        telegramSocketHandlers.deleteMessage(socket, data)
      );
      // Typing Start
      socket.on("telegram:typing_start", (data) =>
        telegramSocketHandlers.typingStart(socket, data)
      );
      // Typing Stop
      socket.on("telegram:typing_stop", (data) =>
        telegramSocketHandlers.typingStop(socket, data)
      );
      // Mark as Read
      socket.on("telegram:mark_as_read", (data) =>
        telegramSocketHandlers.markAsRead(socket, data)
      );

      // Handle disconnection
      socket.on("disconnect", () => {
        console.log(`❎ User ${userId} disconnected`);
      });
    }
  );

  return { io, server };
}

export { io, server };
