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
import { telegramSocketHandlers } from "./telegramSocketHandlers";
import { logger } from "../utils/logger";
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
      logger.info("New client connected:", { socketId: socket.id, userId });

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
        logger.info("User disconnected", { userId });
      });
    }
  );

  return { io, server };
}

export { io, server };
